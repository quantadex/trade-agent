const assert = require('assert');
import { ExecutePosition, BidAskPosition, convertPrecisionToDecimal } from "../src/position";
import {LimitOrder} from "../src/market_classes";

describe('position test', function () {
	it('generate position', function () {
		console.log(convertPrecisionToDecimal(100));
	})

	it('generate position', function (done) {
		const pos = new BidAskPosition(1, 0.05, 5, 100);
		const depth = pos.getPosition(100.00);

		assert.equal(parseFloat(depth.asks[0].price), 107);
		assert.equal(parseFloat(depth.bids[0].price), 98);

		const depth2 = pos.getPosition(105.00);
		assert.equal(parseFloat(depth2.asks[0].price), 107+5);
		assert.equal(parseFloat(depth2.bids[0].price), 97+5);

		//console.log(depth, depth2);
		const exec = new ExecutePosition()
		const actions = exec.getDifference(depth, depth2)
		console.log("DELTA add", actions.add);
		assert.equal(parseFloat(actions.add.asks[0].price), 107 + 5);

		console.log("DELTA remove", actions.remove);
		assert.equal(parseFloat(actions.remove.asks[0].price), 107);

		const actions2 = exec.getDifference({ bids: [], asks:[]}, depth2)
		console.log("DELTA add2", actions2.add);
		console.log("DELTA remove2", actions2.remove);

		done()
	})	

	// let's assume we always set the correct quote price
	it('transform orders to positions', function (done) {
		const orders = [];
		const assets = {
			1: {
				precision: 5
			},
			2: {
				precision: 5
			}
		}

		for(var i=0; i < 5; i++) {
			const order = {
				seller: "",
				for_sale: 150,
				sell_price: {
					base: {
						amount: 150,
						asset_id: 1
					},
					quote: {
						amount: 100,
						asset_id: 2
					}
				}
			}

			orders.push(
				new LimitOrder(order, assets, 2)
			)
		}

		const t = new ExecutePosition().getLevelsFromOrders(orders, 10)

		console.log(t);
		done()
	})
})