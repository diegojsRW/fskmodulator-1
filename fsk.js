/*
 * Javascript FSK Modulator - Mar 2010 Satoshi Ueyama
 * based on Javascript Sound Player by Moriyoshi Koizumi
 */

var SoundPlayer = function() { this.initialize.apply(this, arguments); };
SoundPlayer.packToUInt32LE = function(l) {
	var f = String.fromCharCode;
	return f(l & 255) + f((l >> 8) & 255) + f((l >> 16) & 255) + f((l >> 24) & 255);
};


SoundPlayer.checkCapability = function() {
	if (!window.Audio)
		return false;

	var res = (new Audio()).canPlayType('audio/wav');
	if (!res || res.length == 0)
		return false;

	return true;
}

// -> inline
/*
SoundPlayer.packToInt16LE = function(pck_i) {
	var pck_f = String.fromCharCode;

	if (pck_i > 32767)
		pck_i = 32767;
	else if (pck_i < 0) {
		pck_i = 65536 + pck_i;
		if (pck_i < 32768)
			pck_i = 32768;
	}

	return pck_f(pck_i & 255) + pck_f((pck_i >> 8) & 255);
};
*/

SoundPlayer.FORMAT_WAV  = 0;
SoundPlayer.FORMAT_AIFF = 1;

SoundPlayer.prototype = {
    initialize: function(resolution, container) {
        this.resolution = resolution;
		this.containerElement = container;
    },

	generateAIFFURI: function(samps) {
		var len = samps.length;
		var bytes = [];

		AIFFUtil.makeHeader(bytes, len, 1, 2);
		AIFFUtil.makeCOMM(bytes, len, 1, 16, this.resolution);
		AIFFUtil.makeSSND(bytes, samps, 1, 2);
/*
		var blen = bytes.length;
		var pck_f = String.fromCharCode;
		for (var i = 0;i < blen;i++) {
			bytes[i] = pck_f(bytes[i]);
		}
*/
		return "data:audio/aiff;base64," + base64.encode(bytes);
	},

    generateWavURI: function(samps) {
		var len = samps.length;

        var da;
        var res  = SoundPlayer.packToUInt32LE(this.resolution);
        var res2 = SoundPlayer.packToUInt32LE(this.resolution*2); // 16bit per sample

		// wav header
        da = [
			"RIFF" + SoundPlayer.packToUInt32LE(len + 36),
//               | 4cc |      size     | format | channels|
			"WAVEfmt\x20\x10\x00\x00\x00\x01\x00\x01\x00",

//          |samps|bytes|
			res,  res2, "\x02\x00\x10\x00data",
			SoundPlayer.packToUInt32LE(len*2)
		];

		// data
		var pck_f = String.fromCharCode;

		for (var i = 0;i < len;i++) {
			var pck_i = samps[i];
			if (pck_i > 32767)
				pck_i = 32767;
			else if (pck_i < 0) {
				pck_i = 65536 + pck_i;
				if (pck_i < 32768)
					pck_i = 32768;
			}

			da.push( pck_f(pck_i & 255) + pck_f((pck_i >> 8) & 255) );
		}

		return "data:audio/wav," + escape(da.join(""));
	},

	play: function(samples, useAudioElement, fmt) {
		var datauri;

		if (fmt == SoundPlayer.FORMAT_AIFF)
			datauri = this.generateAIFFURI(samples);
		else
			datauri = this.generateWavURI(samples);

		this.containerElement.innerHTML = '';

		
		var el = document.createElement('audio');
		el.setAttribute('controls', 'controls');
		this.containerElement.appendChild(el);
		el.src = datauri;
		setTimeout(function(){el.play()}, 400);


/*
		var el = document.createElement('a');
		this.containerElement.appendChild(el);
		el.href = datauri;
		el.innerHTML = "download";
*/
/*
		var el = document.createElement('form');
		this.containerElement.appendChild(el);
		el.method = "POST";
		el.action = datauri;
		el.innerHTML = "<input type=\"submit\" />";
*/
		return datauri;
	}
}

var MessageBuilder = function() { this.initialize.apply(this, arguments); };
MessageBuilder.prototype = {
    initialize: function(sink, speed) {
		this.sink  = sink;
		this.speed = speed; // 1 = BASE , 2 = 2xFASTER
		this.bytes = [];
		this.blocks = [];
	},

	clear: function() {
		this.bytes.length = 0;
		this.blocks.length = 0;
	},

	build: function() {
		this.makeEncodedBlocks();

		this.appendPrologue();
		this.appendPreamble(1 - this.getFirstBit());
		this.appendMessageHeader();
		this.appendBlocks();
		this.appendEpilogue();
	},

	appendMessageHeader: function() {
		var k = this.blocks[0].dataLength;
		this.appendByte(k);
		this.appendByte(k);

		return k;
	},

	getFirstBit: function() {
		return this.blocks[0].dataLength & 1;
	},

	appendBlocks: function() {
		var i, k;
		var len = this.blocks.length;
		var plen = ReedSolomonEncoder.getParityLength();

		for (i = 0;i < len;i++) {
			var bk = this.blocks[i];
			var dlen = bk.dataLength;
			for (k = 0;k < dlen;k++) {
				this.appendByte(bk.dataBytes[k]);
			}

			for (k = 0;k < plen;k++) {
				this.appendByte(bk.parityBytes[k]);
			}
		}
	},

	makeEncodedBlocks: function() {
		var bytes = this.bytes;
		var dlen = ReedSolomonEncoder.getDataLength();
		var plen = ReedSolomonEncoder.getParityLength();
		var blockLength = bytes.length;
		var padding = 0, i;
		if (blockLength >= dlen) {
			blockLength = dlen;
		} else {
			padding = dlen - blockLength;
		}

		var tmp = new Array(dlen);
		var pbuf = new Array(plen);
		for (i = 0;i < blockLength;i++) {
			tmp[i] = bytes.shift();
		}

		for (;i < dlen;i++) {
			tmp[i] = 0;
		}

		ReedSolomonEncoder.encode(tmp, pbuf);
		this.blocks.push({
			dataBytes: tmp,
			parityBytes: pbuf,
			dataLength: blockLength
		});
	},

	setBytesFromText: function(s, buffer) {
		var bytes = buffer ? buffer : this.bytes;
		var es = encodeURI(s);
		var pos = 0, len = es.length;
		var k;

		for (;pos < len;) {
			k = es.charCodeAt(pos);
			if (k == 0x25) {
				k =  parseInt(es.charAt(++pos), 16) << 4;
				k |= parseInt(es.charAt(++pos), 16);
			}

			bytes.push(k)
			pos++;
		}

		return bytes;
	},

	appendPreamble: function(termBit) {
		for (var i = 0;i < 22;i++) {
			this.sink.appendBit(1);
			this.sink.appendBit(0);
		}

		if (termBit) {
			this.sink.appendBit(1);
			this.sink.appendBit(1);
		} else {
			this.sink.appendBit(0);
		}
	},

	appendPrologue: function() {
		this.writeBlank(96 * this.speed);
	},

	appendEpilogue: function() {
		this.writeBlank(42 * this.speed);
	},

	appendByte: function(k) {
		for (var i = 0;i < 8;i++)
			this.sink.appendBit((k>>i) & 1);
	},

	writeBlank: function(count) {
		for (var i = 0;i < count;i++)
			this.sink.appendBit(0);
	}
}

var FSKGen = function() { this.initialize.apply(this, arguments); };
FSKGen.CarrierFQ1 = 2100;
FSKGen.CarrierFQ2 = 1300;
FSKGen.CarrierFQM = 100;

FSKGen.prototype = {
    initialize: function(sr, highspeed) {
		this.mWavTbl = null;
		this.mOutSamplingRate = sr;
		this.mReadStep1 = FSKGen.CarrierFQ1 / FSKGen.CarrierFQM;
		this.mReadStep2 = FSKGen.CarrierFQ2 / FSKGen.CarrierFQM;
		this.mSamplesPerBit = highspeed ? 147 /* 300bps */ : 294 /* 150bps */;
		this.setupTable();

		this.clear();
	},

	clear: function() {
		this.mBitCount = 0;
		this.mShiftCount = 0;
		this.mBuffer = [0];
	},

	appendBit: function(b) {
		if (b != 0) {
			this.mBuffer[ this.mBuffer.length - 1 ] |= (1 << this.mShiftCount);
		}

		++this.mShiftCount;
		if ((++this.mBitCount & 0xf) == 0) {
			this.mBuffer.push(0);
			this.mShiftCount = 0;
		}
	},

	readBit: function(i) {
		var block = i >> 4;
		var ofs = i & 0xf;

		return (this.mBuffer[block] >> ofs) & 1;
	},

	dumpBuffer: function() {
		var ret = [];
		var len = this.mBuffer.length;
		for (var i = 0;i < len;i++) {
			ret.push(this.mBuffer[i].toString(16));
		}

		return ret.join('  ');
	},

	setupTable: function() {
		var samples = this.mOutSamplingRate / FSKGen.CarrierFQM;
		this.mWavTbl = new Array(samples);

		for (var i = 0;i < samples;i++) {
			this.mWavTbl[i] = (Math.sin(Math.PI*2.0 * i / samples) * 8192) | 0;
		}
	},

	insertDing: function(a, len) {
		var step = 880*Math.PI / this.mOutSamplingRate;
		for (var i = 0;i < len;i++) {
			var vol = (len-(i<<1))/len;

			if (vol < 0.001)
				a[i] = 0;
			else
				a[i] = (Math.sin(i * step) * vol * 22000.0) | 0;
		}
	},

	generateSamples: function(ding) {
		var datalen = this.mBitCount;
		var blen = this.mSamplesPerBit;
		var slen = blen * datalen;
		var step;
		var bitPos = 0;
		var tblPos = 0;

		var tbl  = this.mWavTbl;
		var tlen = tbl.length;

		var ding_len = ding ? this.mOutSamplingRate : 0;
		var samps = new Array(ding_len + slen);
		if (ding)
			this.insertDing(samps, ding_len);

		for (var i = 0;i < slen;i++) {
			if (!(i % blen)) {
				step = this.readBit(bitPos++) ? this.mReadStep2 : this.mReadStep1;
			}
			tblPos = (tblPos + step) % tlen;

			samps[ding_len + i] = tbl[tblPos];
		}

		return samps;
	}
}