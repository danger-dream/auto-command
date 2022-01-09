let byteArray;
let byteCount;
let byteIndex;

function ucs2decode(string) {
	let output = [];
	let counter = 0;
	let length = string.length;
	let value;
	let extra;
	while (counter < length) {
		value = string.charCodeAt(counter++);
		if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
			extra = string.charCodeAt(counter++);
			if ((extra & 0xFC00) === 0xDC00) {
				output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
			} else {
				output.push(value);
				counter--;
			}
		} else {
			output.push(value);
		}
	}
	return output;
}


function readContinuationByte() {
	if (byteIndex >= byteCount) {
		throw Error('Invalid byte index');
	}
	let continuationByte = byteArray[byteIndex] & 0xFF;
	byteIndex++;
	if ((continuationByte & 0xC0) === 0x80) {
		return continuationByte & 0x3F;
	}
	throw Error('Invalid continuation byte');
}

function checkScalarValue(codePoint) {
	if (codePoint >= 0xD800 && codePoint <= 0xDFFF) {
		throw Error('Lone surrogate U+' + codePoint.toString(16).toUpperCase() + ' is not a scalar value');
	}
}

function decodeSymbol() {
	let byte1;
	let byte2;
	let byte3;
	let byte4;
	let codePoint;
	if (byteIndex > byteCount) {
		throw Error('Invalid byte index');
	}
	if (byteIndex === byteCount) {
		return false;
	}
	// Read first byte
	byte1 = byteArray[byteIndex] & 0xFF;
	byteIndex++;
	// 1-byte sequence (no continuation bytes)
	if ((byte1 & 0x80) === 0) {
		return byte1;
	}
	// 2-byte sequence
	if ((byte1 & 0xE0) === 0xC0) {
		byte2 = readContinuationByte();
		codePoint = ((byte1 & 0x1F) << 6) | byte2;
		if (codePoint >= 0x80) {
			return codePoint;
		} else {
			throw Error('Invalid continuation byte');
		}
	}
	// 3-byte sequence (may include unpaired surrogates)
	if ((byte1 & 0xF0) === 0xE0) {
		byte2 = readContinuationByte();
		byte3 = readContinuationByte();
		codePoint = ((byte1 & 0x0F) << 12) | (byte2 << 6) | byte3;
		if (codePoint >= 0x0800) {
			checkScalarValue(codePoint);
			return codePoint;
		} else {
			throw Error('Invalid continuation byte');
		}
	}
	
	// 4-byte sequence
	if ((byte1 & 0xF8) === 0xF0) {
		byte2 = readContinuationByte();
		byte3 = readContinuationByte();
		byte4 = readContinuationByte();
		codePoint = ((byte1 & 0x07) << 0x12) | (byte2 << 0x0C) |
			(byte3 << 0x06) | byte4;
		if (codePoint >= 0x010000 && codePoint <= 0x10FFFF) {
			return codePoint;
		}
	}
	throw Error('Invalid UTF-8 detected');
}

function ucs2encode(array) {
	let length = array.length;
	let index = -1;
	let value;
	let output = '';
	while (++index < length) {
		value = array[index];
		if (value > 0xFFFF) {
			value -= 0x10000;
			output += String.fromCharCode(value >>> 10 & 0x3FF | 0xD800);
			value = 0xDC00 | value & 0x3FF;
		}
		output += String.fromCharCode(value);
	}
	return output;
}

module.exports = function (byteString){
	byteArray = ucs2decode(byteString);
	byteCount = byteArray.length;
	byteIndex = 0;
	let codePoints = [];
	let tmp;
	while ((tmp = decodeSymbol()) !== false) {
		codePoints.push(tmp);
	}
	return ucs2encode(codePoints);
}