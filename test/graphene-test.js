const assert = require('assert');
import Client, { default_ws } from "../src/graphene";

describe('graphene client', function () {
	it('will sign', function (done) {
		const client = new Client(default_ws, async  function() {
			const user = await client.setupUser(process.env.KEY);

			await client.transfer(user, "1.2.17", "QDEX", "1234", "test memo")

	// 		client.sendLimitOrder(user, true, "QDEX", "ETH", 0.50, 0.05);
	// 		const orders = await client.openOrders(user, "ETH")
	// 		//console.log(orders);
			
	// 		for (const o of orders) {
	// 			console.log("cancel order ", o.id);
	// 			await client.cancelOrder(user, o.id)
	// 		}

	// 		const orders2 = await client.openOrders(user, "ETH")
	// 		// console.log(orders2);

	// 		try {
	// 			client.close()
	// 		}catch(e) {}
	 		done()
	 	})
	 })
})