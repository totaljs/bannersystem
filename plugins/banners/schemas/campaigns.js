NEWSCHEMA('Campaigns', function(schema) {

	schema.define('id', 'UID');
	schema.define('bannerid', 'UID', true);
	schema.define('customer', 'String(50)');
	schema.define('name', 'String(80)', true);
	schema.define('note', 'String(200)');
	schema.define('url', 'URL', true);
	schema.define('limit', ['views', 'clicks', 'date'], true);
	schema.define('count', Number);
	schema.define('photo', String, true);
	schema.define('ignore', String);

	// schema.define('clicks', Number);
	// schema.define('views', Number);
	// schema.define('iscompleted', Boolean);
	schema.define('isdisabled', Boolean);
	schema.define('dtbeg', Date, true);
	schema.define('dtend', Date);

	schema.action('query', {
		name: 'List of campaigns',
		permissions: 'campaigns',
		query: 'q:String',
		params: '*id:UID',
		action: function($) {
			var params = $.params;
			var builder = DATA.list('nosql/campaigns');
			builder.where('bannerid', params.id);
			builder.autoquery($.query, 'id:uid,dtbeg:Date,dtend:Date,bannerid,dtcreated:date,clicks:number,views:number,iscompleted:boolean,isdisabled:boolean,dtupdated:date,name:String,limit,count:number,customer,photo', 'dtcreated_desc', 12);

			if ($.query.q)
				builder.search('search', $.query.q.toSearch());

			builder.callback($);
		}
	});

	schema.action('read', {
		name: 'Read campaign',
		permissions: 'campaigns',
		params: '*id:UID',
		action: function($) {
			var params = $.params;
			DATA.read('nosql/campaigns').id(params.id).error(404).callback($);
		}
	});

	schema.action('save', {
		name: 'Save campaign',
		permissions: 'campaigns',
		action: async function($, model) {

			// if (UNAUTHORIZED($, 'admin'))
			// return;

			model.search = model.name.toSearch();

			if (model.id) {
				model.dtupdated = NOW;

				var response = await DATA.read('nosql/campaigns').id(model.id).error(404).promise($);

				if (model.limit !== 'date')
					model.dtend = null;

				model.iscompleted = model.limit === 'views' ? response.views >= response.count : model.limit === 'clicks' ? response.clicks >= response.count : model.dtend < NOW;
				await DATA.modify('nosql/campaigns', model).id(model.id).promise($);

			} else {

				model.id = UID();
				model.views = 0;
				model.clicks = 0;
				model.userid = $.user.id;
				model.dtcreated = NOW;
				model.iscompleted = false;

				if (model.limit !== 'date')
					model.dtend = null;

				await DATA.insert('nosql/campaigns', model).promise($);
			}

			EMIT('banners_refresh');
			$.success(model.id);
		}
	});

	schema.action('remove', {
		name: 'Remove campaign',
		permissions: 'campaigns',
		params: '*id:UID',
		action: function($) {
			var params = $.params;
			DATA.remove('nosql/campaigns').id(params.id).error(404).callback($.done(params.id));
		}
	});

	schema.action('reset', {
		name: 'Reset campaign',
		permissions: 'campaigns',
		params: '*id:UID',
		action: function($) {
			var params = $.params;
			DATA.modify('nosql/campaigns', { clicks: 0, views: 0, iscompleted: false }).id(params.id).callback($.done(params.id));
		}
	});

	schema.action('disable', {
		name: 'Disable campaign',
		permissions: 'campaigns',
		params: '*id:UID',
		action: function($) {
			var params = $.params;
			var mod = {};

			if ($.query.is)
				mod.isdisabled = $.query.is === '1';
			else
				mod['!isdisabled'] = 1;

			DATA.modify('nosql/campaigns', mod).id(params.id).callback($.done(params.id));
		}
	});
});