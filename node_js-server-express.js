//dynamodb libraries
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB({region: 'eu-west-1', apiVersion: '2012-08-10'});
//express
var express = require('express');
var app = express();
app.configure(function(){
    app.use(express.bodyParser());
});
const NodeCache = require( "node-cache" );
const myCache = new NodeCache( { stdTTL: 100, checkperiod: 120 } );

var port = 8080;

const uuidv1 = require('uuid/v1');


//-------------------ORDER-----------------------------------------

app.get('/orders/:orderId', function(req, res) {
var params = {
  Key: {
   "orderId": {
     S: ""+req.params.orderId
    }
  },
  TableName: "Orders"
 };
 dynamodb.getItem(params, function(err, data) {
   if (err) console.log(err, err.stack); // an error occurred
   else     {
    console.log(data)
    res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    res.contentType('application/json');;
    var body = JSON.parse(data.Item.body.S);
    var response = {};
    response["amount"] = body["totalAmount"];
    response["currency"] = body["currencyCode"];
    response["shippingCost"]=0;
    response["posId"]=body["merchantPosId"];
    response["description"]=body["description"];
    response["email"] = body.buyer.email;
    response["payMethod"] = {"type":null};
    response["products"] = body.products;
    res.send(JSON.stringify(response)); //write a response to the client
    
    
    
   }           // successful response

 });
});


//-------------------POSES-------------------------------------------------

app.get('/poses/:posId', function(req, res) {

	res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    res.contentType('application/json');;
    var response = {};
    response["url"] = "http://payu.pl";
    response["country"] = "PL";
    res.send(JSON.stringify(response));

});

//---------------------PAYTYPES------------------------------------

app.get('/poses/:posId/paytypes', function(req, res) {

	res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    res.contentType('application/json');;
    var response = {"ab":{"status":"ENABLED","min":50,"max":99999999,"category":"PBL"},"blik":{"status":"ENABLED","min":100,"max":99999999,"category":"PBL"},"m":{"status":"ENABLED","min":50,"max":99999999,"category":"PBL"}};
    res.send(JSON.stringify(response));

});


//----------------PAYMENT STATUS-------------------------------

app.get('/orders/:orderId/status', function(req, res) {

	res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    res.contentType('application/json');
    
    var payment = myCache.get(req.params.orderId);
    
    var response = {category: "NEW", value: null, continueUrl: null, refReqId: null};
    
    if (payment!= undefined && payment.status == "IN_PROGRESS"){
        var continueUrl = "/api/front/redirect?paymentId="+payment.id+"&bank="+payment.bank;
    	response = {category: "IN_PROGRESS", value: "WARNING_CONTINUE_PBL", continueUrl: continueUrl, refReqId: null};
    }
    res.send(JSON.stringify(response));

});

//------------------Redirect-------------------

	app.get('/redirect', function(req, res) {

	res.send("bank: "+ req.query.bank  +" payment: "+req.query.paymentId);

});

//----------------PAYMENT CREATE-----------------

app.post('/orders/:orderId/payments', function(req, res) {
	var body = req.body;
	var bank = body.payMethod.type;
	var payment = {"status":"IN_PROGRESS","id":req.params.orderId,"bank":bank}
    console.log(body);
    myCache.set(req.params.orderId,payment);
	res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    res.status(201).send();

});


//---------------OCR------------------------

app.post('/api/v2_1/orders/', function(req, res) {
   var body = req.body;
    console.log(body);
   var orderId = uuidv1();
   body["orderId"]=orderId;
   body["oderCreateDate"] = new Date();
   var params = {
  Item: {
   "orderId": {
     S: orderId
    },
   "body": {
     S: JSON.stringify(body)
    },
   "notifyUrl":{
       	S: body["notifyUrl"]
  }
 },
  ReturnConsumedCapacity: "TOTAL",
  TableName: "Orders"

 };
 dynamodb.putItem(params, function(err, data) {
   if (err) console.log(err, err.stack); // an error occurred
   else     {
   console.log(data);
   res.contentType('application/json');
   res.location("/"+orderId);

   var response = {};
   var code = {};
   code["statusCode"] = "SUCCESS";
   response["status"] = code;
       	response["redirectUri"] = req.headers.host+"/orders/"+orderId;
       	response["oderId"] = orderId;
  // res.setHeader(302, {
  //'Location': '/'+orderId
//});

   res.status(302).send(JSON.stringify(response));           // successful response
  }
 });



});


app.listen(port);
console.log('Listening on port %s...',port);