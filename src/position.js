/**
 * positions.js
 * Caculate target depth and calculate delta between new depth, and old depth
 * to make new orders
 */
import lodash from 'lodash';

export class Position {
	getPosition(price) {
	}
}

Set.prototype.intersection = function (otherSet) {
	// creating new set to store intersection 
	var intersectionSet = new Set();

	// Iterate over the values  
	for (var elem of otherSet) {
		// if the other set contains a  
		// similar value as of value[i] 
		// then add it to intersectionSet 
		if (this.has(elem))
			intersectionSet.add(elem);
	}

	// return values of intersectionSet 
	return intersectionSet;
} 

Set.prototype.difference = function (otherSet) {
	// creating new set to store differnce 
	var differenceSet = new Set();

	// iterate over the values 
	for (var elem of this) {
		// if the value[i] is not present  
		// in otherSet add to the differenceSet 
		if (!otherSet.has(elem))
			differenceSet.add(elem);
	}

	// returns values of differenceSet 
	return differenceSet;
}

export function convertPrecisionToDecimal(precision) {
	const parts =  (precision / 100).toString().split(".")
	if (parts.length == 1) {
		return 0;
	} else {
		return parts[1].length;
	}
}

export class BidAskPosition extends Position {
	// step 10 = 0.10
	constructor(amount = 1, spread = 0.05, depth=5, step = 100) {
		super()
		this.spread = spread;
		this.depth = depth;
		this.step = step;
		this.amount = amount;
	}

	// 100 = 0 => 1
	// 10 = 1 => 0.10
	// 1 = 10 => 0.01
	getLevels(price, step, depth) {
		var levels = [];
		const precision = convertPrecisionToDecimal(step);
		// price = parseFloat(price.toFixed(precision))
		//console.log("price ? ", price);

		for(var i = 0; i < depth; i++) {
			levels.push({
				price: (price + ((i * step)/100)).toFixed(precision),
				amount: this.amount
			})
		}
		return levels;
	}

	// returns []Level bids, and asks
	getPosition(price) {
		const spread = this.spread * price;
		const bid = (price - (spread / 2));
		const ask = (price + (spread / 2));

		return {
			asks: this.getLevels(ask, this.step, this.depth).reverse(),
			bids: this.getLevels(bid, -this.step, this.depth),
		}
	}
}

export class ExecutePosition {
	
	deltaLevel(prevPos, newPos) {
		return lodash.differenceBy(newPos, prevPos, 'price')
	}

	// get list of buy/sells transactions
	getDifference(prevPos, newPos) {
		return {
			add: {
				asks: this.deltaLevel(prevPos.asks, newPos.asks),
				bids: this.deltaLevel(prevPos.bids, newPos.bids)
			},
			remove: {
				asks: this.deltaLevel(newPos.asks, prevPos.asks),
				bids: this.deltaLevel(newPos.bids, prevPos.bids)
			}
		}
	}

	transformOrder(order, step) {
		const precision = convertPrecisionToDecimal(step);
		return {
			id: order.id,
			price: order.getPrice().toFixed(precision),
		}
	}

	getLevelsFromOrders(orders, step) {
		var bids = []
		var asks = []

		for (var o of orders) {
			if (o.isBid()) {
				bids.push(this.transformOrder(o))
			} else {
				asks.push(this.transformOrder(o))
			}
		}
		return {
			asks: asks,
			bids: bids
		}
	}
}
