This is really just an exercise to mess with `Object.observe`.  I'm shooting for the binding functionality of **knockout.js**, the template syntax of **Handlebars**, without the overhead of **Angular**.  

####[Live Demo](http://jsfiddle.net/andrewpetersen15/mmabt420/)

This is a very simple implementation but it does support nested Objects and Arrays (including `Array.push()`).
IE9+ support when using polyfill version, `/dist/droopy-binding.polyfill.js`

## One-way Binding
Automatically update UI when javascript object gets updated


##### HTML
```html
<div id='container' data-id='{{id}}' style='visibility: {{visibility}}'>
	<h1>{{title}}</h1>
	The id is: {{id}}
	<p>{{details}}</p>
	<!-- Reference nested properties with dot notation-->
	<strong>Author: {{author.firstName}} {{author.lastName}}</strong>
	<div style='margin-top:40px'>
		<label>Update the title here:</label>
		<input id='titleTextBox' value='{{title}}' />
	</div>

	<!-- To iterate through an Array, use the data-each attribute-->
	<ul data-each='complexItems'>
    		<!-- If you want to reference a property on the current item as you loop through,
         	use a square bracket instead of a curly brace. '{[itemProperty]}'-->
		<li>{[name]}</li>
	</ul>

	<!-- use an underscore to reference the current scope -->
	<!-- for example, each item in items is just a string, no properties to reference -->
	<ul data-each='stringItems'>
		<li>{[_]}</li>
	</ul>
</div>
```

##### JavaScript
Create your binding by passing the id of the element that contains all of your placeholders, and the object you want to bind to.
```javascript
var binding = new droopyBinding.OnewayBinding('container', viewModel);
binding.init(); // calling init is what actually applys the binding to the UI.
```
In the above example, `viewModel` would be an object like this
```javascript
// setup the initial object to bind to
var viewModel = {
    id: 123,
    title: "Initial Title",
    details: "These are the details",
    visibility: "visible",
    author: {
        firstName: "Andrew",
        lastName: "Petersen",
        id: "12"
    },
    stringItems: [
        "one",
        "two",
        "three",
        "four"
    ],
    complexItems: [
        {
            name: "itemOne",
            id: 1
        }, {
            name: "itemTwo",
            id:2
        }
    ]
};
```

#### Update Examples
```javascript
// Pretend we made an async ajax request (we're faking it with setTimeout) and got new property values for our model
// The 'title' and 'details', and items list will automatically update in the view
// No UI code required
setTimeout(function(responseData){
	viewModel.title = "New Title",
	viewModel.details = "This simulates data changing after an async ajax request";
	viewModel.complexItems = responseData.items;
}, 150);

// Updating a specific array item's nested property will update that item in the view
viewModel.complexItems[0].name = "I'm an array item nested property!";

// Adding a new item to the array will automatically add it to the view
viewModel.complexItems.push({name: "And I'm a whole new item"});
```


