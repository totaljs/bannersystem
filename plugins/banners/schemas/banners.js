NEWSCHEMA('Banners', function(schema) {

	schema.define('id', UID);
	schema.define('name', String);
	schema.define('note', String);
	schema.define('size', String);
	schema.define('icon', String);
	schema.define('color', String);
	schema.define('device', ['all', 'desktop', 'mobile'])('all');
	schema.define('isdisabled', Boolean);
	schema.define('roundedcorners', Boolean);

	schema.action('query', {
		name: 'List of banners',
		permissions: 'banners',
		action: function($) {
			var arr = [];
			var banners = MAIN.db.banners;

			for (var key in banners) {
				var item = banners[key];
				arr.push(item);
			}

			arr.quicksort('dtcreated_desc');
			$.callback(arr);
		}
	});

	schema.action('read', {
		name: 'Read banner',
		permissions: 'banners',
		params: '*id:UID',
		action: function($) {
			var params = $.params;
			var item = MAIN.db.banners[params.id];
			if (item)
				$.callback(item);
			else
				$.invalid(404);
		}
	});

	schema.action('save', {
		name: 'Save banner',
		permissions: 'banners',
		action: function($, model) {
			var id = model.id;
			var item;

			if (model.id) {
				item = MAIN.db.banners[model.id];
				if (!item) {
					$.invalid(404);
					return;
				}
			}

			if (item) {
				item.dtupdated = NOW;
				delete model.id;
				U.copy(model, item, true);
			} else {
				model.id = id = UID();
				model.visitors = 0;
				model.userid = $.user.id;
				model.dtcreated = NOW;
				model.stats = [0, 0, 0, 0, 0, 0, 0];
				MAIN.db.banners[model.id] = model;
			}

			$.success(id);

			EMIT('banners_refresh');
			MAIN.db.save();
		}
	});

	schema.action('remove', {
		name: 'Remove banner',
		permissions: 'banners',
		params: '*id:UID',
		action: function($) {
			var params = $.params;

			if (MAIN.db.banners[params.id]) {
				delete MAIN.db.banners[params.id];
				DATA.remove('nosql/campaigns').where('bannerid', params.id);
				MAIN.db.save();
				EMIT('banners_refresh');
				$.success();
			} else
				$.invalid(404);
		}
	});

	schema.action('disable', {
		name: 'Disable banner',
		permissions: 'banners',
		params: '*id:UID',
		action: function($) {
			var params = $.params;

			var item = MAIN.db.banners[params.id];
			if (item) {
				item.isdisabled = $.query.is ? $.query.is === '1' : !item.isdisabled;
				MAIN.db.save();
				EMIT('banners_refresh');
				$.success();
			} else
				$.invalid(404);
		}
	});

});