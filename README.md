I'm shooting for the binding functionality of **knockout.js**, the template syntax of **Handlebars**, without the overhead of **Angular**.  

Feel free to read the docs, but the best way to get a feel is to play with the demo.
### [Live Demo](http://jsfiddle.net/andrewpetersen15/mmabt420/)

This is a very simple implementation but it does support nested Objects and Arrays (including `Array.push()`).
IE9+ support when using polyfill version, `/dist/droopy-binding.polyfill.js`

## Two-way Binding
Automatically both your UI and javascript object properties when things get changed.

##### HTML
Reference a property anywhere in your HTML using double curly braces `{{property}}`
```html
<div id='container' data-id='{{id}}' style='visibility: {{visibility}}'>
	<h1>{{title}}</h1>
	The id is: {{id}}
	<p>{{details}}</p>
	<!-- Reference nested properties with dot notation-->
	<strong>Author: {{author.firstName}} {{author.lastName}}</strong>

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
- Reference a property anywhere in your HTML using double curly braces `{{property}}`
- Reference nested properties with dot notation `{{author.firstName}}`
- Loop through Arrays using the `data-each` attribute, `data-each='arrayName'`
- When looping through an Array, reference a property on the current item with a curly brace then a square bracket, `{[property]}`
- To reference the current scope, use an underscore,`{{_}}`.  For example, if you are iterating an array of strings, there would no property to reference on each item, so use the underscore to use the current item's value, `<div data-each='names'><h3>{[_]}</h3><div>`.


##### JavaScript
Create your binding by passing:
1. The id of the HTML element that contains all of your placeholders
2. The object you want to bind to

```javascript
var binding = new DroopyBinding('container', viewModel);
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
Lots of times we'll make an AJAX request, get new data, then have write UI code to show the new data in the view. With binding, as soon as you update the viewModel with new data, the view automatically updates. **No UI code required**
```javascript
// Make an AJAX request for new data, and automatically update view when the new data is applied to the viewModel
$.getJSON("/api/mydata").then(function(responseData) {
	viewModel.title = "New Title",
	viewModel.details = "The details have changed to:" + resonseData.details;
	viewModel.complexItems = responseData.items;	
});

// Updating a specific array item's nested property will update that item in the view
viewModel.complexItems[0].name = "I'm an array item nested property!";

// Adding a new item to the array will automatically add it to the view
viewModel.complexItems.push({name: "And I'm a whole new item"});
```


