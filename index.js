require('dotenv').config()

import Client, {default_ws} from "./src/graphene";
import Gdax from 'gdax';
import { ExecutePosition, BidAskPosition } from './src/position';

const BID = true
const ASK = false

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

class GdaxPrice {
	constructor(market) {
		this.gdaxClient = new Gdax.PublicClient();
		this.market = market;
	}

	async update() {
		this.data = await this.gdaxClient.getProductTicker(this.market)
		console.log("GDAX:", this.data.price, this.data.time);
	}

	getPrice() {
		//return (parseFloat(this.data.price) + Math.floor(Math.random() * 7)).toFixed(1);	
		return this.data.price;	
	}
}

class ConstantPrice {
	constructor(price) {
		this.price = price;
	}
	async update() {

	}

	// buy
	getBid() {
		return this.price - 0.01;
	}
	
	getAsk() {
		return this.price;
	}

	getAmount() {
		return 1000000
	}
}

class TradeAgent {
	constructor(ws, keys, spread, levels) {
		const self = this;
		this.users = []
		const quantaClient = new Client(ws, async function() {
			try {
				for (const key of keys) {
					const user = await quantaClient.setupUser(key);
					self.users.push(user)
					console.log("found user: ", user.userId, user.publicKey, key);
				}
			}catch (e) {
				console.log(e)
			};
		})
		
		this.quantaClient = quantaClient;
		this.lastOrders= {};
		this.quantaMarket = [
													{ ticker: "QDEX/USD", 
														price: new ConstantPrice(0.30), clear: false, placed: false },
													{ ticker: "ETH/USD", 
														price: new GdaxPrice("ETH-USD"), 
														clear: true, placed: false, step: 10,
														position: new BidAskPosition(5, spread), counter: 0 }
													];		
	}

	async cancelAll(user) {
		const orders = await this.quantaClient.openOrders(user, "ETH")
		console.log("number of orders ", orders.length);

		try {
			await this.quantaClient.cancelOrder(user, orders.map(e => e.id))
		} catch (e) {
			console.log("cancel failed");
		}


		// for (const o of orders) {
		// 	console.log("cancelAll() user ", user.userId, " order ", o.id);
		// }
	}

	// getOrderId(order) {
	// 	return []
	// }

	async runMarket(market) {
		const [base, counter] = market.ticker.split("/")
		const exec = new ExecutePosition()

		if (!market.clear) {
			if (!market.placed) {
				market.placed = true;
				const orders = [{
					is_buy: true,
					price: market.price.getBid(),
					amount: market.price.getAmount()
				}, {
						is_buy: false,
						price: market.price.getAsk(),
						amount: market.price.getAmount()
					}]
				await this.quantaClient.sendLimitOrder(this.users[0], base, counter, orders);
			}
		} else {

			// step 1: get all of the orders
			const baseO = this.quantaClient.assetsBySymbol[base]
			const counterO = this.quantaClient.assetsBySymbol[counter]

			let orders = await this.quantaClient.openOrders(this.users[0], base)
			orders = orders.filter(order => {
					return (baseO.id == order.sell_price.base.asset_id &&
						counterO.id == order.sell_price.quote.asset_id) ||
						(baseO.id == order.sell_price.quote.asset_id &&
						counterO.id == order.sell_price.base.asset_id);
				})

			const prevLevels = exec.getLevelsFromOrders(orders, market.step)
			console.log("current orders", orders.length, prevLevels);

			// step 2: get latest price
			await market.price.update()
			console.log("update price ", market.price.getPrice());
			const newLevels = market.position.getPosition(parseFloat(market.price.getPrice()))
			//console.log("new levels ", newLevels);
			const deltaLevels = exec.getDifference(prevLevels, newLevels)
			console.log("delta levels ask=", deltaLevels.add.asks)
			console.log("delta levels bids=", deltaLevels.add.bids);

			// step 3a: remove old orders
			const cancelIds = deltaLevels.remove.asks.concat(deltaLevels.remove.bids).map(e => e.id)
			try {
				const result = await this.quantaClient.cancelOrder(this.users[0], cancelIds);
				console.log("cancel ", cancelIds);
			} catch(e) {
				console.log("unable to cancel ", cancelIds);
			}
			
			await sleep(2000)

			// step 3b: add new orders
			const sellOrders = deltaLevels.add.asks.map((o) => {
				return {
					is_buy: false,
					price: parseFloat(o.price),
					amount: o.amount
				}
			})

			const buyOrders = deltaLevels.add.bids.map((o) => {
				return {
					is_buy: true,
					price: parseFloat(o.price),
					amount: o.amount
				}
			})

			if (buyOrders.concat(sellOrders).length > 0) {
				try {
					//console.log("place order: ", base, counter, buyOrders.concat(sellOrders));
					await this.quantaClient.sendLimitOrder(this.users[0], base, counter, buyOrders.concat(sellOrders));
				} catch (e) {
					console.log("exception add order");
				}
			}

			// buy at previous asking price
			if (market.counter % 2 == 0) {
				const bestAsk = newLevels.asks[newLevels.asks.length - 1].price;
				console.log("try to fill best ask: ", bestAsk);
				await this.quantaClient.sendLimitOrder(this.users[1], base, counter, [{
					is_buy: true,
					price: bestAsk,
					amount: 0.10
				}]);
			}

			market.counter += 1
		}
	}

	async runOnce() {
		for (const m of this.quantaMarket) {
			console.log("running for market ", m.ticker);
			try {
				await this.runMarket(m)
			} catch(e) {
				console.log("exception in ", m.ticker, e);
			}
		}
	}

	async run() {
		const self = this;
		await sleep(1000);
		await self.cancelAll(this.users[0]);
		await self.cancelAll(this.users[1]);

		setInterval(async () => {
			await self.runOnce();
		}, 8000)
	}
}

new TradeAgent(process.env.WS, process.env.KEYS.split(","), 0.02, 5).run()