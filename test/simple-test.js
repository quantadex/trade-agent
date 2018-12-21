const assert = require('assert');
import QuantaClient from "../src/graphene";
import { LimitOrder } from "../src/market_classes";

const ws = "wss://api.bts.ai/"

// mocha  --timeout 10000 --require babel-core/register -R spec test/simple-test.js

describe('price test', function () {
	it('generate position', function (done) {
		const c = new QuantaClient(ws, async () => {
			const ob = await c.orderbook("BRIDGE.EVOS", "BRIDGE.BTC")
			console.log(ob);
			done()
		})
	})
})