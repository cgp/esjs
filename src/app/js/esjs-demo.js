define([
	"jquery",
  "esjs",
  "handlebars",
  "faker",
  "handlebars-helpers",
  "bootswatch",  
  "bootstrap"  
], function ($, ES, Handlebars,faker) {
  
   
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
       if ((typeof data != "undefined") && (typeof data == "object") && data.responseText) {
         $(target).append(templates[template](data.responseText));
       } else {
        $(target).append(templates[template](data));
       }
     }
   }
   
   function logFunc(target, template) {     
     return function(data) { 
       if ((typeof data != "undefined") && (typeof data == "object") && data.responseText) {
         
         $(target).append(data.responseText);
       } else {
        $(target).append(data);
       }
     }
   }
   
   es.stats().done(appendFunc("#main", "stats-template"));
   
   es.cluster().done(function(response) {
     appendFunc("#indices", "indices-template")(response);
     appendFunc("#main", "cluster-template")(response);
   });
   
   es.version().done(function(response) {
    var data = {response:response,baseurl:es.baseurl};    
    appendFunc("#main", "version-template")(data);
   });
     
   
   es.nodes().done(appendFunc("#main", "nodes-template"));
   
   es.status().done(appendFunc("#main", "status-template"));   
   
   appendFunc("#main", "console-template")();
   
   var logging = logFunc(".console", "status-template");
   
   function handleExists(val) {

     
     if (val) {
       es.indexDelete("names").then(logging, logging);
     }
     es.indexCreate("names")
        .then(logging, logging)
        .then(function() {
           es.docBulk([{name: "Carson, John"},{name: "McMahon, Ed"},{name: "Correct, Sir"}], {_index: "names", _type: "name"});
        });
     console.log(val);
   }
   
   es.indexExists("names").then(handleExists);
   
});
