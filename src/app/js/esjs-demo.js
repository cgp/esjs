define([
	"jquery",
  "esjs",
  "bootswatch",
  "bootstrap",
  "handlebars"
], function ($, ES) {
  
   var es = new ES.Client();
   
   function logit(result) {     
       console.log(result, es.cache);
   }
   
   es.stats().done(logit);
   es.version().done(logit);
   es.nodes().done(logit);
   es.cluster().done(logit);
   es.status().done(logit);   
});
