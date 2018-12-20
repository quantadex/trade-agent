import QC from "@quantadex/quanta_js";
import Gdax from 'gdax';

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

class TradeAgent {
	constructor(key, spread, levels) {
		this.quantaClient = new QC({ orderbookUrl: QC.OrderBookUrlDefault, secretKey: key })
		this.gdaxClient = new Gdax.PublicClient();
		this.lastOrderId = [];
		this.quantaMarket = "ETH*QB3WOAL55IVT6E7BVUNRW6TUVCAOPH5RJYPUUL643YMKMJSZFZGWDJU3/USD*QB3WOAL55IVT6E7BVUNRW6TUVCAOPH5RJYPUUL643YMKMJSZFZGWDJU3";
		this.spread = 0.01;
	}

	async cancelAll() {
		const res = await this.quantaClient.openOrders()
		if (res.status == 200) {
			const orders = await res.json()
			console.log(orders.CurrentOrders);
			if (orders.CurrentOrders) {
				for (var i = 0; i < orders.CurrentOrders.length; i++) {
					const res = await this.quantaClient.cancelOrder(orders.CurrentOrders[i].Id)
					await sleep(500);
					console.log("cancelling", orders.CurrentOrders[i].Id, res.status);
				}
			}
		}
	}
	async runOnce() {
		for (var i = 0; i < this.lastOrderId.length; i++) {
			const result = await this.quantaClient.cancelOrder(this.lastOrderId[i]);
			await sleep(1500);
			console.log("cancel ", this.lastOrderId[i], result.status);
		}

		this.lastOrderId = [];

		const data = await this.gdaxClient.getProductTicker('ETH-USD')
		console.log("GDAX:", data.price, data.time, data.size, data.bid, data.ask, data.volume);
		const spread = (this.spread * parseFloat(data.price));
		const bid = (parseFloat(data.price) - (spread/2)).toFixed(2);
		const ask = (parseFloat(data.price) + (spread/2)).toFixed(2);
		console.log("submitting ", +bid, +ask);

		// buy order
		const result = await this.quantaClient.submitOrder(0, this.quantaMarket, ""+data.bid, "0.001");
		if (result.status == 200) {
			const json = await result.json()
			console.log("order ", json.Id);
			this.lastOrderId.push(json.Id);
		} else {
			console.log("order failed ", result.status);
		}
		// sell order
		await sleep(1500);
		const result2 = await this.quantaClient.submitOrder(1, this.quantaMarket, ""+data.ask, "0.001");
		if (result2.status == 200) {
			const json = await result2.json()
			console.log("order ", json.Id);
			this.lastOrderId.push(json.Id);
		} else {
			console.log("order failed ", result2.status);
		}
	}
	async run() {
		const self = this;
		await self.cancelAll();
		setInterval(async () => {
			await self.runOnce();
		}, 8000)
	}
}

new TradeAgent("ZBYUCOMTT7UPXG6JSKIQREYF6FLMUFAE42I24VJNX6NOFP7I6BUQWEKV", 0.05, 5).run()