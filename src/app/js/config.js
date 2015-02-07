if (typeof console == 'undefined') {
  console = { 
      log: function() {}
  };
}
require.config({
	"baseUrl": "app/js",	
	"paths": {
		"jquery": "lib/js/jquery/jquery",
		"bootstrap": "lib/js/bootswatch/bootstrap.min",
    "bootswatch": "lib/js/bootswatch/bootswatch",
		"handlebars": "lib/js/handlebars/handlebars",
		"text": "lib/js/require/text",
    "moment": "lib/js/moment/moment",
		"esjs": "lib/js/esjs/esjs",		
    "jsonpath": "lib/js/jsonpath/jsonpath"
	},
	
	"shim": {        
		"handlebars": {
			"exports": "Handlebars",
			"deps": ["moment"]
		},
    "bootstrap": { "deps": ["jquery"] },
    "bootswatch": { "deps": ["jquery", "bootstrap"]},
    "jsonpath": {"exports": "JSONPath"}
    }
});