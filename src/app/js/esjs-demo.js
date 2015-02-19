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
           search
             .post_filter.term("state", "mi").up().up()
             .query.prefix({"first":{value:"a"}});
             
     return search.execute().done(function(response) {
             console.log(response);
     });           
   }
   
    function performSearchTestBool() {
      var search = es.createSearch("names", "name");                 
      var t = search
                .post_filter.term("state", "mi").up().up()
                .query.bool()
                    .should().prefix({"first":{value:"a"}}).up().up()
                    .should().prefix({"first":{value:"b"}}).up().up()
                  .up().up()
              .setSize(100);
      
      // select * from names where (state = "mi") and (first ~= a*)
                    
      //console.log(search.getBody());              
      return search.execute().done(function(response) {
        console.log(response);
      });           
   }
      
   function checkDocCount(dfd, timeToWait) {
     setTimeout(function() {
       console.log('check');
       es.indices.stats("names", "docs").done(function(response) {         
         if (response.indices.names.primaries.docs.count == 30000) {                             
           return dfd.resolve( "hurray" ); // yeah         
         } else {           
           checkDocCount(dfd, 500);
         }
       })
     }, timeToWait);
   }
   
   // So, this is particularly tricky, I think because 
   // 1. I wanted the first loop to iterate immediately
   // 2. Once the promise is made, just make sure you have a handle to it, you don't need to recreate it or pass it back, everything will fall together so long as you resolve the original promise
   // 3. After that, taking this apart, in this style of repeating code, the main driver is the timeout, not the ajax call which is internal to the timeout, and this pattern probably will repeat other places
   function waitForDocCount() {
     var dfd = new jQuery.Deferred();               
     checkDocCount(dfd, 0);             
     return dfd.promise();
   }
   
   function performSimpleSearch() {
      var search = es.createSearch();         
      search.setSize(25)
               .setFields(['first','last','city'])
               .setTimeout("5m")
               .setTrackScores(false)         
               .setPageSize(25, 3)
               .nextPage()
               .prevPage()
               .addSort("sortedField", "asc")
               .setAnalyzeWildcard(true);      
      return search.simpleQueryStringSearch("state:mi").done(function(response) {
        console.log(search.getSearchURL(true));
        console.log(response.hits);
      });
   }
   
   console.log(es.indices, es.baseURL);
   es.indices.exists("names")
//        .then(deleteIndexIfExists)
//        .then(createIndex)
//        .then(createDataInIndex)
//        .then(waitForDocCount)
//        .then(performSearch)
        .then(performSearchTestBool);
        //.then(performSimpleSearch)                
       
});
