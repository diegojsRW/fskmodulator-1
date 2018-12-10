window.AIFFUtil = {
	makeHeader: function(a, n_samples, channels, bytes_per_sample) {
		// 'FORM'
		a.push(0x46);
		a.push(0x4f);
		a.push(0x52);
		a.push(0x4d);

		// file size (BE)
		this.uint32_be(a, n_samples * channels * bytes_per_sample + 46);

		// 'AIFF'
		a.push(0x41);
		a.push(0x49);
		a.push(0x46);
		a.push(0x46);
	},

	uint16_be: function(a, i) {
		a.push((i >> 8) & 255);
		a.push( i & 255 );
	},

	uint32_be: function(a, i) {
		a.push((i >> 24) & 255);
		a.push((i >> 16) & 255);
		a.push((i >> 8) & 255);
		a.push( i & 255 );
	},

	makeCOMM: function(a, n_samples, channels, bits, rate) {
		// 'COMM'
		a.push(0x43);
		a.push(0x4f);
		a.push(0x4d);
		a.push(0x4d);

		// size
		this.uint32_be(a, 18);

		// channels
		this.uint16_be(a, channels);

		// frames
		this.uint32_be(a, n_samples);

		// bits per sample
		this.uint16_be(a, bits);

		// sampling rate (IEEE 80bits float)
		a.push(0x40);
		a.push((22050 == rate) ? 0x0D : 0x0E);

		a.push(0xAC);
		a.push(0x44);
		a.push(0x00);
		a.push(0x00);
		a.push(0x00);
		a.push(0x00);
		a.push(0x00);
		a.push(0x00);
	},

	makeSSND: function(a, samps, ch, bytes_per_sample) {
		var len = samps.length;

		// 'SSND'
		a.push(0x53);
		a.push(0x53);
		a.push(0x4E);
		a.push(0x44);

		// size
		this.uint32_be(a, 8 + len*bytes_per_sample);

		// offset and block size
		this.uint32_be(a, 0);
		this.uint32_be(a, 0);

		for (var i = 0;i < len;i++) {
			var pck_i = samps[i];
			if (pck_i > 32767)
				pck_i = 32767;
			else if (pck_i < 0) {
				pck_i = 65536 + pck_i;
				if (pck_i < 32768)
					pck_i = 32768;
			}

			a.push( (pck_i >> 8) & 255 );
			a.push( pck_i & 255 );
		}
	}
}