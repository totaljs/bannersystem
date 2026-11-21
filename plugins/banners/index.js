// Banners: advertising areas (MAIN.db.banners), their campaigns (the NoSQL database "campaigns") and the public
// endpoint /x/ that websites call to show a banner and to count views and clicks.

exports.icon = 'ti ti-game-board-alt';
exports.name = '@(Banners)';
exports.position = 2;
exports.permissions = [{ id: 'banners', name: 'Banners' }, { id: 'campaigns', name: 'Campaigns' }];
exports.visible = user => user.sa || user.permissions.includes('banners');
exports.import = 'import.html';
exports.routes = [
	{ url: '/banners/{id}/', html: 'detail' }
];

MAIN.campaigns = {};
MAIN.ignore = {};

var REG_SIZE = /^\d{1,4}x\d{1,4}$/;
var PICTURES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

// The API of the banners and the campaigns has no ROUTE() here: every action below declares "route: true", which
// registers it on the API endpoint under its id (e.g. "Banners|list") for signed-in users with its permissions.
// "mcp: true" makes the same action a tool of the MCP server (e.g. "Banners_list"), see plugins/mcp/.
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
	summary: 'Lists every banner (an advertising area of the websites) with its id, name, size in px, target device, the number of running campaigns and the views of today.',
	route: true,
	mcp: true,
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
	summary: 'Reads one banner: its settings, "visitors" (views of today) and "stats" (the views of the last 7 days, index 0 is Sunday).',
	route: true,
	mcp: true,
	permissions: 'banners',
	input: '*id:UID // The id of the banner',
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
	summary: 'Creates a banner (without "id") or updates the banner with the "id". A new banner needs "name" and "size". Returns the id of the banner. The HTML snippet for websites is <div class="x" data-id="ID"></div> with the script /x.min.js of this app.',
	route: true,
	mcp: true,
	permissions: 'banners',
	input: 'id:UID // The id of the banner to update (empty creates a new banner)\n' +
		'name:String(80) // The name of the banner\n' +
		'note:String(200) // An internal note\n' +
		'size:String(9) // The size in px as WIDTHxHEIGHT (for example 300x250)\n' +
		'icon:String(40) // A Total.js icon (for example ti ti-game-board-alt)\n' +
		'color:String(30) // A color in HEX\n' +
		'device:{all|desktop|mobile} // The devices that show the banner (default: all)\n' +
		'isdisabled:Boolean // true hides the banner on the websites\n' +
		'roundedcorners:Boolean // true rounds the corners of the picture',
	action: function($, model) {
		var id = model.id;
		var item;

		if (model.size && !REG_SIZE.test(model.size)) {
			$.invalid('@(The size must be WIDTHxHEIGHT, for example 300x250)', 'size');
			return;
		}

		if (model.id) {
			item = MAIN.db.banners[model.id];
			if (!item) {
				$.invalid(404);
				return;
			}
		} else if (!model.name || !model.size) {
			$.invalid(model.name ? '@(A new banner needs a size)' : '@(A new banner needs a name)', model.name ? 'size' : 'name');
			return;
		}

		if (item) {
			item.dtupdated = NOW;
			delete model.id;

			// Only the fields that the caller sent (the MCP tools often send only the changed ones)
			for (var key in model) {
				if (model[key] != null && (key !== 'name' || model.name))
					item[key] = model[key];
			}

		} else {
			if (!model.device)
				model.device = 'all';
			if (!model.icon)
				model.icon = 'ti ti-game-board-alt';
			model.id = id = UID();
			model.visitors = 0;
			model.campaigns = 0;
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
	summary: 'Removes a banner together with all its campaigns. It cannot be undone.',
	route: true,
	mcp: true,
	permissions: 'banners',
	input: '*id:UID // The id of the banner',
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
	name: 'Enable or disable banner',
	summary: 'Shows ("enabled") or hides ("disabled") a banner on the websites. Without "state" it switches the current state.',
	route: true,
	mcp: true,
	permissions: 'banners',
	input: '*id:UID // The id of the banner\n' +
		'state:{enabled|disabled} // The new state (empty switches it)',
	action: function($, model) {
		var item = MAIN.db.banners[model.id];
		if (item) {
			item.isdisabled = model.state ? model.state === 'disabled' : !item.isdisabled;
			MAIN.db.save();
			EMIT('banners_refresh');
			$.success(item.isdisabled ? 'disabled' : 'enabled');
		} else
			$.invalid(404);
	}
});

// ==================================
// Campaigns
// ==================================

var CAMPAIGN_FIELDS = 'id:uid,dtbeg:Date,dtend:Date,bannerid,dtcreated:date,clicks:number,views:number,iscompleted:boolean,isdisabled:boolean,dtupdated:date,name:String,limit,count:number,customer,photo,url,note';

NEWACTION('Campaigns|list', {
	name: 'List of campaigns',
	summary: 'Lists the campaigns of a banner (or of all banners without "id"), newest first, 12 per page. Every campaign has its views, clicks, limit, dates and the flags iscompleted (the limit is reached) and isdisabled (paused).',
	route: true,
	mcp: true,
	permissions: 'campaigns',
	query: 'q:String // Words in the name of the campaign\n' +
		'page:Number // The page (from 1)\n' +
		'limit:Number // Campaigns per page (at most 100)\n' +
		'sort:String // For example dtcreated_desc or views_desc',
	input: 'id:UID // The id of the banner (empty lists the campaigns of all banners)',
	action: async function($, model) {
		var builder = DATA.list('nosql/campaigns');

		if (model.id)
			builder.where('bannerid', model.id);

		builder.autoquery($.query, CAMPAIGN_FIELDS, 'dtcreated_desc', 100);

		if ($.query.q)
			builder.search('search', $.query.q.toSearch());

		$.callback(await builder.promise($));
	}
});

NEWACTION('Campaigns|read', {
	name: 'Read campaign',
	summary: 'Reads one campaign with its views and clicks (the counters of the last minute are added on the next minute).',
	route: true,
	mcp: true,
	permissions: 'campaigns',
	input: '*id:UID // The id of the campaign',
	action: async function($, model) {
		$.callback(await DATA.read('nosql/campaigns').id(model.id).error(404).promise($));
	}
});

NEWACTION('Campaigns|save', {
	name: 'Save campaign',
	summary: 'Creates a campaign in a banner (without "id") or updates the campaign with the "id". The campaign runs from "dtbeg" until its limit: a number of views or clicks ("count") or a date ("dtend"). "photo" is the address of the picture (Pictures_upload returns one) and should have the size of the banner. Returns the id of the campaign.',
	route: true,
	mcp: true,
	permissions: 'campaigns',
	input: 'id:UID // The id of the campaign to update (empty creates a new campaign)\n' +
		'*bannerid:UID // The id of the banner that shows the campaign\n' +
		'customer:String(50) // The name of the customer\n' +
		'*name:String(80) // The name of the campaign\n' +
		'note:String(200) // An internal note\n' +
		'*url:URL // The address opened by a click on the banner\n' +
		'*limit:{views|clicks|date} // What ends the campaign\n' +
		'count:Number // The number of views or clicks for the limits views and clicks\n' +
		'*photo:String // The address of the picture (https://... or /download/...)\n' +
		'ignore:String // Words separated by ; that skip the campaign on pages whose address or title contains them\n' +
		'isdisabled:Boolean // true pauses the campaign\n' +
		'*dtbeg:Date // The start of the campaign\n' +
		'dtend:Date // The end of the campaign for the limit date',
	action: async function($, model) {

		if (!MAIN.db.banners[model.bannerid]) {
			$.invalid('@(The banner does not exist)', 'bannerid');
			return;
		}

		if (model.limit === 'date') {
			if (!model.dtend) {
				$.invalid('@(The limit date needs an end date)', 'dtend');
				return;
			}
		} else {
			model.dtend = null;
			if (!model.count || model.count < 1) {
				$.invalid('@(The limits views and clicks need a count of 1 or more)', 'count');
				return;
			}
		}

		model.search = model.name.toSearch();

		if (model.id) {

			var response = await DATA.read('nosql/campaigns').fields('views,clicks').id(model.id).error(404).promise($);

			model.dtupdated = NOW;
			model.iscompleted = model.limit === 'views' ? response.views >= model.count : model.limit === 'clicks' ? response.clicks >= model.count : model.dtend < NOW;
			await DATA.modify('nosql/campaigns', model).id(model.id).promise($);

		} else {

			model.id = UID();
			model.views = 0;
			model.clicks = 0;
			model.userid = $.user.id;
			model.dtcreated = NOW;
			model.iscompleted = model.limit === 'date' ? model.dtend < NOW : false;

			await DATA.insert('nosql/campaigns', model).promise($);
		}

		EMIT('banners_refresh');
		$.success(model.id);
	}
});

NEWACTION('Campaigns|remove', {
	name: 'Remove campaign',
	summary: 'Removes a campaign with its stats. It cannot be undone.',
	route: true,
	mcp: true,
	permissions: 'campaigns',
	input: '*id:UID // The id of the campaign',
	action: async function($, model) {
		await DATA.remove('nosql/campaigns').id(model.id).error(404).promise($);
		EMIT('banners_refresh');
		$.success(model.id);
	}
});

NEWACTION('Campaigns|reset', {
	name: 'Reset campaign',
	summary: 'Sets the views and the clicks of a campaign to 0 so it runs again until its limit.',
	route: true,
	mcp: true,
	permissions: 'campaigns',
	input: '*id:UID // The id of the campaign',
	action: async function($, model) {
		await DATA.modify('nosql/campaigns', { clicks: 0, views: 0, iscompleted: false }).id(model.id).error(404).promise($);
		EMIT('banners_refresh');
		$.success(model.id);
	}
});

NEWACTION('Campaigns|disable', {
	name: 'Pause or start campaign',
	summary: 'Pauses ("paused") or starts again ("running") a campaign. Without "state" it switches the current state.',
	route: true,
	mcp: true,
	permissions: 'campaigns',
	input: '*id:UID // The id of the campaign\n' +
		'state:{running|paused} // The new state (empty switches it)',
	action: async function($, model) {
		var mod = {};

		if (model.state)
			mod.isdisabled = model.state === 'paused';
		else
			mod['!isdisabled'] = 1;

		await DATA.modify('nosql/campaigns', mod).id(model.id).error(404).promise($);
		EMIT('banners_refresh');
		$.success(model.id);
	}
});

// ==================================
// Pictures
// ==================================

// The interface uploads pictures through POST /upload/ (controllers/api.js); an AI sends them as a data URI
NEWACTION('Pictures|upload', {
	name: 'Upload picture',
	summary: 'Uploads the picture of a campaign (PNG, JPEG, GIF, WebP or SVG, 1 MB at most) and returns its "url" for the "photo" of Campaigns_save.',
	mcp: true,
	permissions: 'campaigns',
	input: '*name:String(100) // The file name (for example spring-sale.png)\n' +
		'*data:DataURI // The picture as a data URI (data:image/png;base64,...)',
	action: function($, model) {

		var data = model.data;
		var ext = data ? PICTURES[data.type] : null;

		if (!ext) {
			$.invalid('@(The picture must be PNG, JPEG, GIF, WebP or SVG)', 'data');
			return;
		}

		if (data.buffer.length > 1024 * 1024) {
			$.invalid('@(The picture is larger than 1 MB)', 'data');
			return;
		}

		var id = UID();
		var name = model.name.replace(/\.[0-9a-z]+$/i, '').max(60) + '.' + ext;

		FILESTORAGE('files').save(id, name, data.buffer, function(err, response) {
			if (err)
				$.invalid(err);
			else
				$.callback({ id: id, url: (CONF.url || '') + '/download/' + id + '.' + ext, width: response.width, height: response.height, size: response.size });
		});
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

// The address of the app can change in the settings
ON('configure', () => script = null);

function banner($) {

	var arr = ($.query.id || '').split('-');
	var id = arr[0];
	var banner = MAIN.db.banners[id];
	var device = $.mobile ? 'mobile' : 'desktop';

	if (!banner || banner.isdisabled || (banner.device && banner.device !== 'all' && banner.device !== device)) {
		$.empty();
		return;
	}

	var campaigns = MAIN.campaigns[id] || EMPTYARRAY;

	// A click: id-previd-campaignid
	if (arr[2]) {

		var ad = campaigns.findItem('id', arr[2]);
		if (!ad) {
			$.empty();
			return;
		}

		var referrer = $.headers.referer || '';

		ad.clicks2++;

		if ($.query.origin)
			$.response.headers.referer = $.query.origin;
		else if (referrer)
			$.response.headers.referer = referrer;

		$.redirect(ad.url + ((ad.url.indexOf('?') === -1 ? '?' : '&') + 'utm_medium=banner&utm_source=' + encodeURIComponent(referrer)));
		return;
	}

	var previd = arr[1];
	var href = $.headers['x-href'];
	var title = $.headers['x-title'] || '';
	var item = null;

	banner.visitors++;

	if (href)
		href = decodeURIComponent(href).toLowerCase();

	if (title)
		title = decodeURIComponent(title).toLowerCase();

	var list = MAIN.ignore[id] ? [] : campaigns;

	if (MAIN.ignore[id]) {
		for (var a of campaigns) {
			if (a.ignore && (href || title)) {
				var skip = false;
				for (var ignore of a.ignore) {
					if ((title && title.indexOf(ignore) !== -1) || (href && href.indexOf(ignore) !== -1)) {
						skip = true;
						break;
					}
				}
				if (skip)
					continue;
			}
			list.push(a);
		}
	}

	if (previd) {
		var index = list.findIndex('id', previd);
		if (index == -1) {
			item = list.random(true);
		} else {
			item = list[index + 1];
			if (!item)
				item = list[0];
		}
	} else
		item = list.random(true);

	if (item) {
		item.views2++;
		$.json({ id: item.id, device: banner.device, html: ('<a href="{0}" target="_blank" rel="nofollow"><img src="{1}" alt="{2}" border="0" style="display:block;max-width:100%;height:auto' + (banner.roundedcorners ? ';border-radius:5px' : '') + '" /></a>').format($.hostname('/x/') + '?id=' + id + '-' + (previd || '') + '-' + item.id, (item.photo && item.photo[0] === '/' ? $.hostname(item.photo) : item.photo).encode(), (item.name || '').encode()) });
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
					mod.iscompleted = ad.dtend < NOW;
				DATA.modify('nosql/campaigns', mod).id(ad.id);
				ad.clicks2 = ad.views2 = 0;
			}
		}
	}

	// Refreshes ads
	DATA.find('nosql/campaigns').fields('id,bannerid,name,ignore,condition,limit,count,url,photo,clicks,views,dtend').query('doc.dtbeg<=NOW && !doc.iscompleted && !doc.isdisabled').callback(function(err, response) {

		MAIN.campaigns = {};
		MAIN.ignore = {};

		for (var item of (response || EMPTYARRAY)) {

			// A campaign until a date ends without any view
			if (item.limit === 'date' && item.dtend && item.dtend < NOW)
				continue;

			item.clicks2 = 0;
			item.views2 = 0;
			item.ignore = item.ignore ? item.ignore.toLowerCase().split(/,|;/).trim().filter(Boolean) : null;

			if (item.ignore && item.ignore.length)
				MAIN.ignore[item.bannerid] = true;
			else
				item.ignore = null;

			if (MAIN.campaigns[item.bannerid])
				MAIN.campaigns[item.bannerid].push(item);
			else
				MAIN.campaigns[item.bannerid] = [item];
		}

		for (var key in MAIN.db.banners) {
			var banner = MAIN.db.banners[key];
			var arr = MAIN.campaigns[key];
			banner.campaigns = arr ? arr.length : 0;
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
