(function() {
	var W = window;
	W.bannersystemrefresh = function() {
		var append = function(el) {
			var ls = W.localStorage;
			var id = el.getAttribute('data-id');
			var aid = (ls && ls.getItem('a_' + id)) || '';
			var req = new XMLHttpRequest();
			req.addEventListener('load', function() {
				if (req.responseText) {
					try {
						var data = JSON.parse(req.responseText);
						if (data) {
							el.innerHTML = data.html;
							if (ls) {
								try {
									ls.setItem('a_' + id, data.id);
								} catch(e) {}
							}
						}
					} catch (e) {}
				}
			});
			req.open('GET', '{0}/x/?id=' + id + '-' + aid);
			req.setRequestHeader('x-href', encodeURIComponent(location.href));
			req.setRequestHeader('x-title', encodeURIComponent(document.title));
			req.send();
		};
		var arr = document.querySelectorAll('.x');
		for (var i = 0; i < arr.length; i++)
			setTimeout(append, (100 * i + 1), arr[i]);
	};
	setTimeout(W.bannersystemrefresh, 50);
})();