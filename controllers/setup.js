// The setup interface: one page that loads the UI of the visible plugins.

exports.install = function() {
	ROUTE('+GET /setup/*', setup);
};

function setup($) {

	if ($.user.openplatform && !$.user.iframe && $.query.openplatform) {
		$.cookie(CONF.op_cookie, $.query.openplatform, NOW.add('12 hours'));
		$.redirect($.url);
		return;
	}

	var plugins = [];

	for (var key in Total.plugins) {
		var item = Total.plugins[key];
		if ($.user.sa || !item.visible || item.visible($.user)) {
			var obj = {};
			obj.id = item.id;
			obj.routes = item.routes;
			obj.position = item.position;
			obj.name = TRANSLATE($.user.language || '', item.name);
			obj.icon = item.icon;
			obj.import = item.import;
			plugins.push(obj);
		}
	}

	plugins.quicksort('position');
	$.view('index', plugins);
}