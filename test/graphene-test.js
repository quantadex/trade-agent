const assert = require('assert');
import Client, { default_ws } from "../src/graphene";

const userId = "1.2.22";

describe('graphene client', function () {
	it('will sign', function (done) {
		const client = new Client(default_ws, process.env.KEY, userId, async  function() {
			client.sendLimitOrder(true, "QDEX", "ETH", 0.50, 0.05);
			const orders = await client.openOrders("ETH")
			console.log(orders);
			
			for (const o of orders) {
				console.log("cancel order ", o, o.id);
				await client.cancelOrder(o.id)
			}

			const orders2 = await client.openOrders("ETH")
			console.log(orders2);

			client.close()
			done()
		})
	})
})