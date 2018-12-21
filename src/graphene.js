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

export function signAndBroadcast(tr, pKey) {
	return tr.set_required_fees().then(() => {
		tr.add_signer(pKey, pKey.toPublicKey().toPublicKeyString());
		//console.log("serialized transaction:", tr.serialize().operations);
		return tr.broadcast()
			.then((res) => {
				console.log("Call order update success!");
				return res;
			})
	});
}

class QuantaClient {
	constructor(ws, key, user_id, onReady) {
		this.privateKey = PrivateKey.fromWif(key);
		this.userId = user_id;
		const self = this;
		Apis.instance(ws, true, 3000, { enableOrders: true }).init_promise.then((res) => {
			console.log("connected");
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

	async sendLimitOrder(is_buy, base, counter, price, amount) {
		const tr = new TransactionBuilder();

		const expiration = new Date();
		expiration.setYear(expiration.getFullYear() + 5);

		const priceObj = new Price({
			base: new Asset({
				asset_id: this.assetsBySymbol[base].id,
				precision: this.assetsBySymbol[base].precision
			}),
			quote: new Asset({
				asset_id: this.assetsBySymbol[counter].id,
				precision: this.assetsBySymbol[counter].precision
			})
		})

		priceObj.setPriceFromReal(parseFloat(price))
		const sellAmount = priceObj.base.clone()
		sellAmount.setAmount({ real: parseFloat(amount) });

		const forSale = is_buy ? sellAmount : sellAmount.times(priceObj);
		const toReceive = is_buy ? sellAmount.times(priceObj) : sellAmount;

		tr.add_type_operation("limit_order_create", {
			fee: {
				amount: 0,
				asset_id: "1.3.0"
			},
			seller: this.userId,
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

		const res = await signAndBroadcast(tr, this.privateKey)
			.then((e) => {
				//console.log("order result ", e);
			});
			
		return res;
	}

	openOrders(counter) {
		const self = this;
		return Apis.instance()
			.db_api()
			.exec("get_full_accounts", [[this.userId], true])
			.then(results => {
				var orders = [];
				results[0][1].limit_orders.forEach((ordered) => {
					var order = new LimitOrder(
						ordered,
						self.assets,
						self.assetsBySymbol[counter].id
					);
					orders.push(order)
				})
				return orders
			});
	}

	async cancelOrder(orderId) {
		const fee_asset_id = "1.3.0";

		const tr = new TransactionBuilder();
		tr.add_type_operation("limit_order_cancel", {
			fee: {
				amount: 0,
				asset_id: fee_asset_id
			},
			fee_paying_account: this.userId,
			order: orderId
		});

		const res = await signAndBroadcast(tr, this.privateKey)
			.then((e) => {
				//console.log("order result ", e);
			});

		return res;
	}
}

export default QuantaClient;
