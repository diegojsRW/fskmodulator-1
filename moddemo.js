function JSModulatorDemo()
{
	var highspeed = true;
	this.baud = highspeed ? 300 : 150;
	this.snd = new SoundPlayer(44100, document.getElementById('player-box'));
	this.fsk = new FSKGen(44100, highspeed);
	this.builder = new MessageBuilder(this.fsk, highspeed ? 2 : 1);
	this.oldValue = null;
	this.previewBuf = [];

	var _this = this;
	var fn = function(){_this.updatePreview()}
	$('#sourcetext').click(fn).keypress(fn).keyup(fn);
	$('#startbutton').click(function(){_this.start()});

	fn();
	this.showParams();
}

JSModulatorDemo.prototype = {
	start: function() {
		this.fsk.clear();
		this.builder.clear();

		var bytes = this.builder.setBytesFromText($('#sourcetext').val());
		if (bytes.length > ReedSolomonEncoder.getDataLength()) {
			return;
		}

		this.builder.build();
		this.snd.play(this.fsk.generateSamples(true), undefined, SoundPlayer.FORMAT_WAV);
	},

	updatePreview: function() {
		var val = $('#sourcetext').val();
		if (val == this.oldValue)
			return;

		this.previewBuf.length = 0;
		this.builder.setBytesFromText(val, this.previewBuf);
		this.toHex(this.previewBuf);

		var maxlen = ReedSolomonEncoder.getDataLength();

		$('#preview-bytes').text(this.previewBuf.join(' '));
		$('#preview-count').text(this.previewBuf.length+'/'+maxlen + (this.previewBuf.length<2 ? " byte" :" bytes"));

		var lenover = this.previewBuf.length > maxlen;
		$('#preview-count')[0].className = lenover ? 'over' : '';
		this.oldValue = val;

		if (lenover)
			$('#startbutton').attr('disabled', 'disabled');
		else
			$('#startbutton').removeAttr('disabled');
	},

	showParams: function() {
		$('#modparams').text("Baud Rate: "+this.baud+" baud(bps)");
	},

	toHex: function(a)
	{
		var len = a.length;
		for (var i = 0;i < len;i++) {
			var h = a[i].toString(16);
			if (a[i] < 16)
				h = "0"+h;

			a[i] = h;
		}
	}
}