# BannerSystem

Open-source banner system for portals and websites. Run, set up your advertising areas (banners) and add ad campaigns.

- Total.js 5 (`total5` beta) with the admin template
- jComponent v20
- No database server: the data are kept in the embedded NoSQL database of Total.js
- MCP server and MCP code mode: manage the banners and the campaigns from an AI app

## Installation

- Install [__Node.js__](https://nodejs.org/en/)
- Install the NPM dependencies in the app folder: `$ npm install`
- Run it: `$ node index.js 8000`
- Open `http://localhost:8000` and sign in with the default account shown on the sign-in page, then change it in the account menu
- Set the public address of the app in __Settings__ (it is used by the script for websites and by the MCP code mode)

## Banners on websites

Place the script at the bottom of your website, only once:

```html
<script src="https://banners.yourdomain.com/x.min.js" async defer></script>
```

Place a container where the banner appears (the id of the banner is in its detail, __Set up a banner on your website__):

```html
<div class="x" data-id="BANNER_ID"></div>
```

## MCP server

`$mcp : true` in the `config` file turns on the MCP server (`POST /$mcp/`) and the MCP code mode (`GET /$mcp/client.js`).

1. Open __MCP access__ and create a token. The AI works with the permissions of the person who created it.
2. Connect your AI app, for example Claude Code:

```bash
claude mcp add --transport http bannersystem https://banners.yourdomain.com/$mcp/ --header "Authorization: Bearer YOUR_TOKEN"
```

Tools: `Banners_list`, `Banners_read`, `Banners_save`, `Banners_remove`, `Banners_disable`, `Campaigns_list`, `Campaigns_read`, `Campaigns_save`, `Campaigns_remove`, `Campaigns_reset`, `Campaigns_disable` and `Pictures_upload`.

### MCP code mode

An AI that can run Node.js 18 or newer downloads the tools as a JavaScript client, writes one script with many calls and reads only its output:

```js
// curl -H "Authorization: Bearer YOUR_TOKEN" https://banners.yourdomain.com/$mcp/client.js -o client.js
const api = require('./client.js')('YOUR_TOKEN');

(async function() {
	const banners = await api.Banners_list();
	const campaigns = await api.Campaigns_list({ query: { limit: 100 } });
	console.log(banners.length, campaigns.count);
})();
```

---

- [Documentation](https://docs.totaljs.com/bannersystem/)
- [Website](https://www.totaljs.com/bannersystem/)
- [Chat support](https://platform.totaljs.com/?open=messenger)
- [Join __Total.js Telegram__](https://t.me/totalplatform)
- [Support](https://www.totaljs.com/support/)
- MIT license
