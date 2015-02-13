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

   es.nodesStats().done(appendFunc("#main", "stats-template"));
      

   es.cluster().done(function(response) {
     appendFunc("#main", "cluster-template")(response);
   });

   es.version().done(function(response) {
    var data = {response:response,baseurl:es.baseurl};
    appendFunc("#main", "version-template")(data);
   });


   es.nodes().done(appendFunc("#main", "nodes-template"));

   es.status().done(function(response) {
     console.log(response.indices);
     appendFunc("#indices", "indices-template")(response);
     appendFunc("#main", "status-template")(response);
   });

   appendFunc("#main", "console-template")();

   var logging = logFunc(".console", "status-template");

   function createIndex() {    
     return es.indices.create("names");
   }
   
   function createDataInIndex() {
     var promises = [];
          for(var y=0;y<3;y++) {
            var os = [];
            for(var x=0;x<10000;x++) {
              var o = {
                first: faker.name.firstName(),
                last: faker.name.lastName(),
                state: faker.address.stateAbbr(),
                phrase: faker.hacker.phrase(),
                loc: {lo: faker.address.longitude(), la:faker.address.latitude()}
              };
              os.push(o);
            }
            promises.push(es.docBulk(os, {_index: "names", _type: "name"}));
            os = null;
            console.log(y);
          }          
     return $.when.apply($, promises);
   }
   
   function deleteIndexIfExists(val) {     
     if (val) {       
       return es.indices.remove("names");           
     } else {       
       return null; // I think this is ok.
     }
   }
   
   function performSearch() {
           var search = es.createSearch("names", "name");
           console.log("performing search...");
     return search.execute().done(function(response) {
             console.log(response);
     });           
   }
   
   function getDocCount() {
     return es.indices.stats("names", "docs").done(function(response) {
       console.log(response);
     });
   }
   
   function performSimpleSearch() {
      var search = es.createSearch();
         
      search.setSize(25)
               .setFields(['a','b','c'])
               .setTimeout("5m")
               .setTrackScores(false)         
               .setPageSize(25, 3)
               .nextPage()
               .prevPage()
               .addSort("sortedField", "asc")
               .setAnalyzeWildcard(true);
      console.log(search.getSearchURL(true));
      return search.simpleQueryStringSearch("state:mi").done(function(response) {
        console.log(response.hits);
      });
   }
   
   console.log(es.indices, es.baseURL);
   es.indices.exists("names")
        .then(deleteIndexIfExists)
        .then(createIndex)
        .then(createDataInIndex)
        .then(performSearch)
        .then(performSimpleSearch)
        .then(getDocCount)
        .then(performSimpleSearch)
        .then(getDocCount);
      
   window.performSimpleSearch = performSimpleSearch;
   window.getDocCount = getDocCount;
        
   
       
});
