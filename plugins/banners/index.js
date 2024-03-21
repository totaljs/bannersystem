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

var processed = 0;

exports.install = function() {

	// Banners
	ROUTE('+API    /api/    -banners                 *Banners   --> query');
	ROUTE('+API    /api/    -banners_read/{id}       *Banners   --> read');
	ROUTE('+API    /api/    +banners_save            *Banners   --> save');
	ROUTE('+API    /api/    -banners_remove/{id}     *Banners   --> remove');
	ROUTE('+API    /api/    -banners_disable/{id}    *Banners   --> disable');

	// Campaigns
	ROUTE('+API    /api/    -campaigns/{id}                *Campaigns    --> query');
	ROUTE('+API    /api/    -campaigns_read/{id}           *Campaigns    --> read');
	ROUTE('+API    /api/    +campaigns_save                *Campaigns    --> save');
	ROUTE('+API    /api/    -campaigns_remove/{id}         *Campaigns    --> remove');
	ROUTE('+API    /api/    -campaigns_disable/{id}        *Campaigns    --> disable');
	ROUTE('+API    /api/    -campaigns_reset/{id}          *Campaigns    --> reset');

	// Banners
	ROUTE('GET /x/', banner);
	ROUTE('FILE /x.min.js', filescript);

};

function filescript(req, res) {
	if (processed == 2) {
		res.continue();
	} else if (processed === 1) {
		setTimeout(filescript, 100, req, res);
	} else {
		processed = 1;
		PATH.fs.readFile(PATH.public('x.js'), function(err, response) {
			PATH.fs.writeFile(PATH.public('x.min.js'), U.minify_js(response.toString('utf8').replace('{0}', CONF.url || req.hostname())), function() {
				processed = 2;
				res.continue();
			});
		});
	}
}

function banner() {

	var $ = this;
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
			$.res.setHeader('referer', $.query.origin);
		else if (referrer)
			$.res.setHeader('referer', referrer);

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