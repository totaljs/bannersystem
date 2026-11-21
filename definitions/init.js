// The data of BannerSystem: MAIN.db (MEMORIZE('data'), created in modules/openplatform.js) keeps the banners,
// the settings and the MCP tokens; the campaigns are in the NoSQL database "campaigns".

var db = MAIN.db;

if (!db.banners)
	db.banners = {};

if (!db.mcp)
	db.mcp = [];

var config = db.config;

if (!config.name)
	config.name = 'BannerSystem';

// Version 1 kept the tokens of the OpenPlatform without the switch "op" of the admin template
if (config.op == null && config.op_reqtoken && config.op_restoken)
	config.op = true;

// Version 1 managed the app with an access token in the address (?token=...); the admin template signs in with a login
// and the AI apps use the tokens of "MCP access"
delete config.token;
delete db.tokens;

// Fixed settings
CONF.op_icon = 'ti ti-game-board-alt';

// Additional variables
MAIN.cache = {};
