import {
	SerializerValidation,
	TransactionBuilder,
	TransactionHelper
} from "@quantadex/bitsharesjs";

import lodash from 'lodash';

import { PrivateKey, PublicKey, Aes, key, ChainStore } from "@quantadex/bitsharesjs";
import { Price, Asset, LimitOrder } from "./market_classes";
import { Apis } from "@quantadex/bitsharesjs-ws";

export const default_ws = "ws://testnet-01.quantachain.io:8090";

export function signAndBroadcast(tr, user) {
	return tr.set_required_fees().then(() => {
		const pKey = user.privateKey;
		tr.add_signer(pKey, pKey.toPublicKey().toPublicKeyString());
		//console.log("serialized transaction:", tr.serialize().operations);
		return tr.broadcast()
			.then((res) => {
				return res;
			})
	});
}

class QuantaClient {
	constructor(ws, onReady) {
		const self = this;
		Apis.instance(ws, true, 3000, { enableOrders: true }).init_promise.then((res) => {
			console.log("connected to ", ws);
			return Apis.instance().db_api().exec("list_assets", ["A", 100]).then((assets) => {
				//console.log("assets ", assets);
				self.assets = lodash.keyBy(assets, "id")
				self.assetsBySymbol = lodash.keyBy(assets, "symbol")
				
				if (onReady) {
					onReady()
				}
			});
		});
	}

	close() {
		Apis.close()
	}

	async setupUser(key) {
		const privateKey = PrivateKey.fromWif(key);
		const publicKey = privateKey.toPublicKey().toString()

		const result = await Apis.instance()
			.db_api()
			.exec("get_key_references", [[publicKey]]);
		//console.log(result);
		return {
			privateKey: privateKey,
			userId: result[0][0],
			publicKey: publicKey
		}
	}

	calculatePrice(is_buy, base, counter, price, amount) {
		const priceObj = new Price({
			base: new Asset({
				asset_id: this.assetsBySymbol[counter].id,
				precision: this.assetsBySymbol[counter].precision
			}),
			quote: new Asset({
				asset_id: this.assetsBySymbol[base].id,
				precision: this.assetsBySymbol[base].precision
			}),
			real: parseFloat(price)
		})

		//console.log(priceObj);
		
		// USD
		const sellAmount = priceObj.quote.clone()  
		sellAmount.setAmount({ real: parseFloat(amount) });
		
		const amountBase = priceObj.quote.clone()
		amountBase.setAmount({ real: parseFloat(amount) });

		//console.log("is_buy", is_buy, priceObj.toReal(), sellAmount.getAmount(true));
		const forSale = is_buy ? sellAmount.times(priceObj, is_buy) : amountBase;
		const toReceive = is_buy ? amountBase : sellAmount.times(priceObj, is_buy);

		return {forSale, toReceive}
	}

	async sendLimitOrder(user, base, counter, orders) {
		const tr = new TransactionBuilder();

		const expiration = new Date();
		expiration.setYear(expiration.getFullYear() + 5);

		for (var {is_buy, price, amount} of orders ) {
			const { forSale, toReceive } = this.calculatePrice(is_buy, base, counter, price, amount)

			tr.add_type_operation("limit_order_create", {
				fee: {
					amount: 0,
					asset_id: "1.3.0"
				},
				seller: user.userId,
				amount_to_sell: {
					amount: forSale.getAmount(),
					asset_id: forSale.asset_id
				},
				min_to_receive: {
					amount: toReceive.getAmount(),
					asset_id: toReceive.asset_id
				},
				expiration: expiration,
				fill_or_kill: false
			});
		}

		const res = await signAndBroadcast(tr, user);
			
		return res;
	}

	orderbook(base, counter) {
		console.log(this.assetsBySymbol[base]);
		const self = this;
		return Apis.instance()
			.db_api()
			// 1.3.1570
			.exec("get_order_book", ["1.3.1570", "1.3.4521", 50])
	}

	openOrders(user, base) {
		const self = this;
		return Apis.instance()
			.db_api()
			.exec("get_full_accounts", [[user.userId], true])
			.then(results => {
				var orders = [];
				results[0][1].limit_orders.forEach((ordered) => {
					var order = new LimitOrder(
						ordered,
						self.assets,
						self.assetsBySymbol[base].id
					);
					orders.push(order)
				})
				return orders
			});
	}

	async cancelOrder(user, orders) {
		if (orders.length == 0) {
			return
		}

		const fee_asset_id = "1.3.0";
		const tr = new TransactionBuilder();

		for (var order_id of orders) {
			tr.add_type_operation("limit_order_cancel", {
				fee: {
					amount: 0,
					asset_id: fee_asset_id
				},
				fee_paying_account: user.userId,
				order: order_id
			});
		}

		const res = await signAndBroadcast(tr, user)
		return res;
	}
}

export default QuantaClient;
