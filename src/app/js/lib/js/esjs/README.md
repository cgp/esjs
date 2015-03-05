This is sort of a Roadmap/Featurelist, a simple way to track what is or isn't supported
yet as part of esjs....

Legend: 
------
Done - Code Support, Documented, Tested
Mostly Done - Coded but either Documented or Tested, but not both
Coded - Code support



Query Type                    | Status
------------------------------|-----------
bool query                    | Coded
boosting query                | Coded
common terms query            | Coded
constant score query          | Mostly Done
dis max query                 | Coded
filtered query                | Coded
fuzzy like this query         | Coded
fuzzy like this field query   | (not needed)
function score query          | 
fuzzy query                   | Coded
geoshape query                | Coded
has child query               | Coded
has parent query              | Coded
ids query                     | Coded
indices query                 | Coded
match all query               | Coded
more like this query          | Coded
more like this field query    | *deprecated, so not coded*
nested query                  | Coded
prefix query                  | Coded
query string query            | Coded
simple query string query     | Coded
range query                   | Coded
regexp query                  | Coded
span first query              | Coded and Tested
span multi term query         | Coded and Tested
span near query               | Coded and Tested
span not query                | Coded
span or query                 | Coded and Tested
span term query               | Coded and Tested
term query                    | Coded
terms query                   | Coded
top children query            | Coded
wildcard query                | Coded
template query                |


Filter Type                   | Status
------------------------------|----------
and filter                    | Coded
bool filter                   | Coded
exists filter                 | Coded
geo bounding box filter       | Coded
geo distance filter           | Coded
geo distance range filter     | Coded
geo polygon filter            | Coded
geoshape filter               | Coded
geohash cell filter           | Coded
has child filter              | (taken from query)
has parent filter             | (taken from query)
ids filter                    | (taken from query)
indices filter                | (taken from query)
limit filter                  | Coded
match all filter              | (taken from query)
missing filter                | Coded
nested filter                 | (mostly taken from query)
not filter                    | Coded
or filter                     | Coded
prefix filter                 | (mostly taken from query)
query filter                  | (mostly taken from query)
range filter                  | (mostly taken from query)
regexp filter                 | (mostly taken from query)
script filter                 |  
term filter                   | (mostly taken from query)
terms filter                  | (mostly taken from query)
type filter                   | Coded



Indices Support               | Status
------------------------------|----------
Mappings                      | Coded and Tested


