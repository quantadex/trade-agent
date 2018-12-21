import Client, {default_ws} from "./src/graphene";
import Gdax from 'gdax';

const userId = "1.2.22";

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

class GdaxPrice {
	constructor(market, spread) {
		this.gdaxClient = new Gdax.PublicClient();
		this.spread = spread;
		this.market = market;
	}

	async update() {
		this.data = await this.gdaxClient.getProductTicker(this.market)
		console.log("GDAX:", this.data.price, this.data.time);
		const spread = (this.spread * parseFloat(this.data.price));
		const bid = (parseFloat(this.data.price) - (spread / 2)).toFixed(2);
		const ask = (parseFloat(this.data.price) + (spread / 2)).toFixed(2);
		this.bid = bid;
		this.ask = ask;
	}

	getBid() {
		return this.bid;
	}

	getAsk() {
		return this.ask;
	}

	getAmount() {
		return 0.05
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
	constructor(key, spread, levels) {
		this.quantaClient = new Client(default_ws, key, userId, null);
		this.lastOrders= {};
		this.quantaMarket = [
													{ ticker: "QDEX/USD", 
														price: new ConstantPrice(0.30), clear: false, placed: false },
													{ ticker: "ETH/USD", 
														price: new GdaxPrice("ETH-USD", spread), clear: true, placed: false }
													];		
	}

	async cancelAll() {
		const orders = await this.quantaClient.openOrders("USD")
		for (const o of orders) {
			console.log("cancel order ", o.id);
			await this.quantaClient.cancelOrder(o.id)
		}
	}

	async runMarket(market) {
		if (market.clear) {
			const orders = this.lastOrders[market.ticker] || []
			for (const o of orders) {
				const result = await this.quantaClient.cancelOrder(o.id);
				console.log("cancel ",o, result.status);
			}
		}
		const parts = market.ticker.split("/")

		if (!market.clear) {
			if (!market.placed) {
				market.placed = true;
				await this.quantaClient.sendLimitOrder(true, parts[0], parts[1], market.price.getBid(), market.price.getAmount());
				await this.quantaClient.sendLimitOrder(false, parts[0], parts[1], market.price.getAsk(), market.price.getAmount());
			}
		} else {
			market.price.update()
			await this.cancelAll()
			await this.quantaClient.sendLimitOrder(true, parts[0], parts[1], market.price.getBid(), market.price.getAmount());
			await this.quantaClient.sendLimitOrder(false, parts[0], parts[1], market.price.getAsk(), market.price.getAmount());
		}
	}

	async runOnce() {
		for (const m of this.quantaMarket) {
			console.log("running for market ", m.ticker);
			await this.runMarket(m)
		}
	}

	async run() {
		const self = this;
		await sleep(1000);
		await self.cancelAll();
		setInterval(async () => {
			await self.runOnce();
		}, 8000)
	}
}

new TradeAgent(process.env.KEY, 0.05, 5).run()