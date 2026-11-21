// Banners: advertising areas (MAIN.db.banners), their campaigns (the NoSQL database "campaigns") and the public
// endpoint /x/ that websites call to show a banner and to count views and clicks.

exports.icon = 'ti ti-game-board-alt';
exports.name = '@(Banners)';
exports.position = 2;
exports.permissions = [{ id: 'banners', name: 'Banners' }];
exports.visible = user => user.sa || user.permissions.includes('banners');
exports.import = 'import.html';
exports.routes = [
	{ url: '/banners/{id}/', html: 'detail' }
];

MAIN.campaigns = {};
MAIN.ignore = {};

// The API of the banners and the campaigns has no ROUTE() here: every action below declares "route: true", which
// registers it on the API endpoint under its id (e.g. "Banners|list") for signed-in users with its permissions.
exports.install = function() {

	// Banners on websites
	ROUTE('GET /x/', banner);
	ROUTE('FILE /x.min.js', filescript);

};

// ==================================
// Banners
// ==================================

NEWACTION('Banners|list', {
	name: 'List of banners',
	route: true,
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

NEWACTION('Banners|read', {
	name: 'Read banner',
	route: true,
	permissions: 'banners',
	input: '*id:UID',
	action: function($, model) {
		var item = MAIN.db.banners[model.id];
		if (item)
			$.callback(item);
		else
			$.invalid(404);
	}
});

NEWACTION('Banners|save', {
	name: 'Save banner',
	route: true,
	permissions: 'banners',
	input: 'id:UID, name:String, note:String, size:String, icon:String, color:String, device:{all|desktop|mobile}, isdisabled:Boolean, roundedcorners:Boolean',
	action: function($, model) {
		var id = model.id;
		var item;

		if (!model.device)
			model.device = 'all';

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

NEWACTION('Banners|remove', {
	name: 'Remove banner',
	route: true,
	permissions: 'banners',
	input: '*id:UID',
	action: function($, model) {
		if (MAIN.db.banners[model.id]) {
			delete MAIN.db.banners[model.id];
			DATA.remove('nosql/campaigns').where('bannerid', model.id);
			MAIN.db.save();
			EMIT('banners_refresh');
			$.success();
		} else
			$.invalid(404);
	}
});

NEWACTION('Banners|disable', {
	name: 'Disable banner',
	route: true,
	permissions: 'banners',
	input: '*id:UID',
	query: 'is:String',
	action: function($, model) {
		var item = MAIN.db.banners[model.id];
		if (item) {
			item.isdisabled = $.query.is ? $.query.is === '1' : !item.isdisabled;
			MAIN.db.save();
			EMIT('banners_refresh');
			$.success();
		} else
			$.invalid(404);
	}
});

// ==================================
// Campaigns
// ==================================

NEWACTION('Campaigns|list', {
	name: 'List of campaigns',
	route: true,
	permissions: 'campaigns',
	query: 'q:String, page:Number, limit:Number, sort:String',
	input: '*id:UID',
	action: async function($, model) {
		var builder = DATA.list('nosql/campaigns');
		builder.where('bannerid', model.id);
		builder.autoquery($.query, 'id:uid,dtbeg:Date,dtend:Date,bannerid,dtcreated:date,clicks:number,views:number,iscompleted:boolean,isdisabled:boolean,dtupdated:date,name:String,limit,count:number,customer,photo', 'dtcreated_desc', 12);

		if ($.query.q)
			builder.search('search', $.query.q.toSearch());

		$.callback(await builder.promise($));
	}
});

NEWACTION('Campaigns|read', {
	name: 'Read campaign',
	route: true,
	permissions: 'campaigns',
	input: '*id:UID',
	action: async function($, model) {
		$.callback(await DATA.read('nosql/campaigns').id(model.id).error(404).promise($));
	}
});

NEWACTION('Campaigns|save', {
	name: 'Save campaign',
	route: true,
	permissions: 'campaigns',
	input: 'id:UID, *bannerid:UID, customer:String(50), *name:String(80), note:String(200), *url:URL, *limit:{views|clicks|date}, count:Number, *photo:String, ignore:String, isdisabled:Boolean, *dtbeg:Date, dtend:Date',
	action: async function($, model) {
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

NEWACTION('Campaigns|remove', {
	name: 'Remove campaign',
	route: true,
	permissions: 'campaigns',
	input: '*id:UID',
	action: async function($, model) {
		await DATA.remove('nosql/campaigns').id(model.id).error(404).promise($);
		$.success(model.id);
	}
});

NEWACTION('Campaigns|reset', {
	name: 'Reset campaign',
	route: true,
	permissions: 'campaigns',
	input: '*id:UID',
	action: async function($, model) {
		await DATA.modify('nosql/campaigns', { clicks: 0, views: 0, iscompleted: false }).id(model.id).promise($);
		$.success(model.id);
	}
});

NEWACTION('Campaigns|disable', {
	name: 'Disable campaign',
	route: true,
	permissions: 'campaigns',
	input: '*id:UID',
	query: 'is:String',
	action: async function($, model) {
		var mod = {};

		if ($.query.is)
			mod.isdisabled = $.query.is === '1';
		else
			mod['!isdisabled'] = 1;

		await DATA.modify('nosql/campaigns', mod).id(model.id).promise($);
		$.success(model.id);
	}
});

// ==================================
// Banners on websites
// ==================================

// The script for websites (public/x.js) is minified once and kept in memory together with the address of this app
var script = null;

function filescript($) {

	if (script) {
		$.binary(script, 'text/javascript');
		return;
	}

	PATH.fs.readFile(PATH.public('x.js'), function(err, response) {

		if (err) {
			$.invalid(404);
			return;
		}

		script = Buffer.from(U.minify_js(response.toString('utf8').replace('{0}', CONF.url || $.hostname())), 'utf8');
		$.binary(script, 'text/javascript');
	});
}

function banner($) {

	var arr = ($.query.id || '').split('-');
	var id = arr[0];
	var banner = MAIN.db.banners[id];
	var device = $.mobile ? 'mobile' : 'desktop';

	if (!banner || banner.isdisabled || (banner.device && banner.device !== 'all' && banner.device !== device)) {
		$.empty();
		return;
	}

	if (arr[2]) {

		var ad = MAIN.campaigns[id].findItem('id', arr[2]);
		var referrer = $.headers.referer || '';

		banner.clicks2++;
		ad.clicks2++;

		if ($.query.origin)
			$.response.headers.referer = $.query.origin;
		else if (referrer)
			$.response.headers.referer = referrer;

		$.redirect(ad.url + ((ad.url.indexOf('?') === -1 ? '?' : '&') + 'utm_medium=banner&utm_source=' + encodeURIComponent(referrer)));
		return;
	}

	var previd = arr[1];
	var campaigns = MAIN.campaigns[id] || EMPTYARRAY;
	var href = $.headers['x-href'];
	var title = $.headers['x-title'] || '';
	var item = null;

	banner.visitors++;

	if (href)
		href = decodeURIComponent(href).toLowerCase();

	var arr = MAIN.ignore[id] ? [] : campaigns;

	if (MAIN.ignore[id] && href) {
		for (var a of campaigns) {
			if (a.ignore) {
				var skip = false;
				for (var ignore of a.ignore) {
					if ((title && title.indexOf(ignore) !== -1) || href.indexOf(ignore) !== -1) {
						skip = true;
						break;
					}
				}
				if (skip)
					continue;
			}
			arr.push(a);
		}
	}

	if (previd) {
		var index = arr.findIndex('id', previd);
		if (index == -1) {
			item = arr.random(true);
		} else {
			item = arr[index + 1];
			if (!item)
				item = arr[0];
		}
	} else
		item = arr.random(true);

	if (item) {
		item.views2++;
		$.json({ id: item.id, device: banner.device, html: ('<a href="{0}" target="_blank" rel="nofollow"><img src="{1}" border="0" style="display:block;max-width:100%;height:auto' + (banner.roundedcorners ? ';border-radius:5px' : '') + '" /></a>').format($.hostname('/x/') + '?id=' + id + '-' + previd + '-' + item.id, item.photo && item.photo[0] === '/' ? $.hostname(item.photo) : item.photo, item.name) });
	} else
		$.empty();
}

function refresh() {

	// Saves stats
	for (var key in MAIN.campaigns) {
		for (var ad of MAIN.campaigns[key]) {
			if (ad.clicks2 || ad.views2) {
				var mod = { '+clicks': ad.clicks2, '+views': ad.views2 };
				if (ad.limit === 'clicks')
					mod.iscompleted = (ad.clicks + ad.clicks2) >= ad.count;
				else if (ad.limit === 'views')
					mod.iscompleted = (ad.views + ad.views2) >= ad.count;
				else if (ad.limit === 'date')
					mod.iscompleted = mod.dtend < NOW;
				DATA.modify('nosql/campaigns', mod).id(ad.id);
			}
		}
	}

	// Refreshes ads
	DATA.find('nosql/campaigns').fields('id,bannerid,name,ignore,condition,limit,count,url,photo,clicks,views,dtend').query('doc.dtbeg<=NOW && !doc.iscompleted && !doc.isdisabled').callback(function(err, response) {

		MAIN.campaigns = {};
		MAIN.ignore = {};

		for (var item of response) {

			item.clicks2 = 0;
			item.views2 = 0;
			item.ignore = item.ignore ? item.ignore.split(/,|;/).trim() : null;

			if (item.ignore)
				MAIN.ignore[item.bannerid] = true;

			if (MAIN.campaigns[item.bannerid])
				MAIN.campaigns[item.bannerid].push(item);
			else
				MAIN.campaigns[item.bannerid] = [item];
		}

		for (var key in MAIN.db.banners) {
			var item = MAIN.db.banners[key];
			var arr = MAIN.campaigns[key];
			item.campaigns = arr ? arr.length : 0;
		}

	});
}

ON('service', function() {

	// New day
	// Reset stats
	if (NOW.format('HH:mm') === '00:00') {
		var prevday = NOW.add('-1 hour').getDay();
		for (var key in MAIN.db.banners) {
			var banner = MAIN.db.banners[key];
			banner.stats[prevday] = banner.visitors || 0;
			banner.visitors = 0;
		}
	}

	refresh();
	MAIN.db.save();
});

ON('banners_refresh', refresh);
ON('ready', refresh);