// Public HTTP routes: the home page, the upload of campaign pictures and their download.

exports.install = function() {

	CORS();

	// A picture of a campaign, 1 MB at most
	ROUTE('+POST /api/upload/ @upload <1MB', upload);

	// Index
	ROUTE('GET /', index);
	ROUTE('FILE /download/*.*', download);
};

function index($) {
	if (CONF.token)
		$.text(CONF.name);
	else
		$.redirect('/setup/');
}

function upload($) {

	var file = $.files[0];

	if (file) {
		file.fs('files', UID(), $.successful(function(response) {
			response.url = $.hostname('/download/{id}.{ext}'.args(response));
			$.json(response);
		}));
	} else
		$.json(null);

}

function download($) {
	var filename = $.split[1];
	var index = filename.lastIndexOf('.');
	$.filefs('files', filename.substring(0, index), !!$.query.download);
}