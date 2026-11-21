// Public HTTP routes: the upload of campaign pictures and their download. The admin interface is served by the admin
// template (modules/openplatform.js) on every other address.

exports.install = function() {

	// Websites load the banners (/x/) from other domains
	CORS();

	// A picture of a campaign, 1 MB at most
	ROUTE('+POST /upload/ @upload <1MB', upload);

	ROUTE('FILE /download/*.*', download);
};

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
