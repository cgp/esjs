define([
	"jquery",
  "esjs",
  "handlebars",
  "handlebars-helpers",
  "bootswatch",  
  "bootstrap"  
], function ($, ES, Handlebars) {
  
   var templates = {};
   $("script[type='text/x-handlebars-template']").each(function(idx, el) {          
     templates[el.id] = Handlebars.compile($(el).html());     
     Handlebars.registerPartial(el.id, $(el).html());
   });
   
   var es = new ES.Client();

   
   function replaceFunc(target, template) {     
     return function(data) {       
      $(target).html(templates[template](data));
     }
   }
   
   function appendFunc(target, template) {     
     return function(data) {            
      $(target).append(templates[template](data));
     }
   }
   
   es.stats().done(appendFunc("#main", "stats-template"));
   
   es.cluster().done(function(response) {
     appendFunc("#indices", "indices-template")(response);
     appendFunc("#main", "cluster-template")(response);
   });
   
   es.version().done(function(response) {
    var data = {response:response,baseurl:es.baseurl};
    console.log(data);
    appendFunc("#main", "version-template")(data);
   });
     
   
   es.nodes().done(appendFunc("#main", "nodes-template"));
   
   es.status().done(appendFunc("#main", "status-template"));   
});
