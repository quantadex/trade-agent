const assert = require('assert');
import QuantaClient from "../src/graphene";
import {LimitOrder} from "../src/market_classes";

// mocha  --timeout 10000 --require babel-core/register -R spec test/price-test.js

describe('price test', function () {
	it('generate position', function (done) {
		const c = new QuantaClient("ws://localhost:8090", () => {
			const { forSale, toReceive } = c.calculatePrice(true, "ETH", "USD", 131, 0.02096)
			console.log("sell: ", forSale, "\nreceive: ", toReceive);
			const order = {
				for_sale: forSale.getAmount(),
				sell_price: {
					base: {
						amount: forSale.getAmount(),
						asset_id: forSale.asset_id
					},
					quote: {
						amount: toReceive.getAmount(),
						asset_id: toReceive.asset_id
					}
				}
			}
			const limit = new LimitOrder(order, c.assets, c.assetsBySymbol["ETH"].id)
			console.log("Price=", limit.getPrice(), "amount=", limit.totalForSale().getAmount(true));
			done()
		})
	})
})