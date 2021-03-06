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
     //console.log(response.indices);
     appendFunc("#indices", "indices-template")(response);
     appendFunc("#main", "status-template")(response);
   });

   appendFunc("#main", "console-template")();

   var logging = logFunc(".console", "status-template");

   function deleteIndexIfExists(val) {     
     if (val) {       
       return es.indices.remove("names");           
     } else {       
       return null; // I think this is ok.
     }
   }
   
   function createIndex() {    
     return es.indices.create("names");
   }
   
   function setupMappings() {
      var mappings = new ES.Mapping();      
        
      var t = mappings.mapping('name')
              .properties("first").type("string").up().up()
              console.log(t);
              t.properties("loc").type("geo_point");
      es.ajax("names/_mapping/name", mappings.getBody(), null, {type: "PUT"})
      console.log(mappings.getBody());     
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
                birthdate: faker.date.past(40),
                number: require('faker').random.number(10000),
                loc: {lon: faker.address.longitude(), lat:faker.address.latitude()}
              };
              os.push(o);
            }
            promises.push(es.docBulk(os, {_index: "names", _type: "name"}));
            os = null;
            console.log(y);
          }          
     return $.when.apply($, promises);
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
   
   function performSearch() {
           var search = es.createSearch("names", "name");           
           var t = search
             .post_filter.term("state").value("mi").up().up().up()             
             .query.prefix("first").value("a");
             
     return search.execute().done(function(response) {
             console.log("performSearch()", response);
     });           
   }
   
    function performSearchTestBool() {
      var search = es.createSearch("names", "name");                 
      var t = search
                .post_filter.term("state").value("mi").up().up().up()
                .query
                  .bool()
                   .should().prefix("first").value("a").up().up().up()
                   .should().prefix("first").value("b").up().up().up()
                   .must().range("number").lte(1000).up().up().up() 
                  .up().up(); // query, search
                  
                  t.setSize(100);
      //console.log(search.getBody());              
      return search.execute().done(function(response) {
        console.log("performSearchTestBool()", response);
      });           
   }
   
   function performSearchTestRegEx() {
      var search = es.createSearch("names", "name");                 
      var t = search
                .post_filter.term("state").value("mi").up().up().up()
                .query
                  .bool()
                   .should().prefix("first").value("a").up().up().up()
                   .should().prefix("first").value("b").up().up().up()
                   .must().regexp("last").value("si.*").up().up().up() //important to remember that even in a regex, it's lowercsae
                  .up().up(); // query, search
                  
                  t.setSize(100);
      //console.log(search.getBody());              
      return search.execute().done(function(response) {
        console.log("performSearchTestRegEx()", response);
      });           
   }
   
   function performSearchTestGeoDistance() {
      var search = es.createSearch("names", "name");                 
      var t = search
                .post_filter.geo_distance("loc", {"lat": 42.4811399, "lon": -83.494441}).distance("300mi").up().up()                
                //console.log("...",t, t.up(), t.up().up());
                t.setSize(100);                        
      
      return search.execute().done(function(response) {
        console.log("performSearchGeoDistance()", response);
      });                 
   }
   
   function performSearchTestSpanMultiMatch() {
      var search = es.createSearch("names", "name");                 
      console.log(search.query);
      var t = search.query
                      .span_first()
                      .end(3)
                      .match()
                      .span_term("phrase").value('jbod');
                search.setSize(100);                        
      
      return search.execute().done(function(response) {
        console.log("performSearchTestSpanMultiMatch()", response);
      });                 
   }
   
   function performSearchTestSpanFirst() {
      var search = es.createSearch("names", "name");                 
      console.log(search.query);
      var t = search.query
                      .span_first()
                      .end(3)
                      .match()
                      .span_multi().match().prefix("phrase").value('prog');
                search.setSize(100);                        
      
      return search.execute().done(function(response) {
        console.log("performSearchTestSpanFirst()", response);
      });                 
   }
   
   function performSearchTestSpanOr() {
      var search = es.createSearch("names", "name");                 
      console.log(search.query);
      var t = search.query
                      t=t.span_or(); console.log("...",t);
                     t= t.clauses(); console.log("qqq",t);
                      t.span_multi().match().prefix("phrase").value('prog');
                search.setSize(100);                        
      
      return search.execute().done(function(response) {
        console.log("performSearchTestSpanOr()", response);
      });                 
   }
   
   function performSearchTestSpanNear() {
      var search = es.createSearch("names", "name");                 
      console.log(search.query);
      
      var spanQueryPart = search.query.span_near().slop(4).in_order(true).collect_payloads(true);      
      spanQueryPart.clauses().span_multi().match().prefix("phrase").value('prog');
      spanQueryPart.clauses().span_multi().match().prefix("phrase").value('optical');
      spanQueryPart.clauses().span_multi().match().prefix("phrase").value('prog');      
      
      search.setSize(100);                        
      
      return search.execute().done(function(response) {
        console.log("performSearchTestSpanNear()", response);
      });                 
   }   
   
   function performSearchTestAggs() {
      var search = es.createSearch("names", "name");                 
      console.log(search.query);
      
      var agg = search.aggs.aggs("bob");
      var t = agg.extended_stats().field("number");            
      
      search.setSize(100);                        
      
      return search.execute().done(function(response) {
        console.log("performSearchTestAggs()", response);
      });                 
   }   
   
   function performSearchTestAggFilters() {
      var search = es.createSearch("names", "name");                 
      var agg = search.aggs.aggs("bob");
      var filters = agg.filters();
      var t = filters.filters("steve");
      
      console.log(t);            
      t.term("phrase").value('fax');
      
      search.setSize(100);                              
      return search.execute().done(function(response) {
        console.log("performSearchTestAggFilters()", response);
      });                 
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
        //console.log(search.getSearchURL(true));
        console.log(response.hits);
      });
   }
   
   //console.log(es.indices, es.baseURL);
   
   es.indices.exists("names")
        //.then(deleteIndexIfExists)
        //.then(createIndex)
        //.then(setupMappings)
        //.then(createDataInIndex)        
        //.then(waitForDocCount)
        //.then(performSearch)
        
        //.then(performSearchTestRegEx)
        //.then(performSearchTestBool)
        .then(performSearchTestGeoDistance)
        //.then(performSearchTestSpanFirst)
        //.then(performSearchTestSpanMultiMatch)
        //.then(performSearchTestSpanNear)
        //.then(performSearchTestAggs)
        .then(performSearchTestAggFilters)
        //.then(performSimpleSearch)
    
});
