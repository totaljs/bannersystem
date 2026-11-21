// Settings: the name of the app, the access token and the tokens of the OpenPlatform (MAIN.db.config).

exports.icon = 'ti ti-cog';
exports.name = '@(Configuration)';
exports.permissions = [{ id: 'setup', name: 'Setup' }];
exports.position = 10;
exports.visible = user => user.sa || user.permissions.includes('setup');

NEWACTION('Setup|read', {
	name: 'Read configuration',
	route: true,
	permissions: 'setup',
	action: function($) {
		$.callback(MAIN.db.config);
	}
});

NEWACTION('Setup|save', {
	name: 'Save configuration',
	route: true,
	input: '*name:String, token:String, totalapi:String, op_reqtoken:String, op_restoken:String',
	permissions: 'setup',
	action: function($, model) {
		COPY(model, MAIN.db.config);
		LOADCONFIG(model);
		MAIN.db.save();
		$.success();
	}
});