var gulp = require("gulp");
var minify = require('gulp-uglify');
var rename = require('gulp-rename');
var browserify = require('gulp-browserify');

var browserifyAndMinify = function(entry, minifiedName) {
	return gulp.src(entry)
		.pipe(browserify({
			debug: true
		}))
		.pipe(gulp.dest('./dist/'))
		.pipe(rename(minifiedName))
		.pipe(minify())
		.pipe(gulp.dest('./dist/'));
};

gulp.task('standard', function(){
	browserifyAndMinify('./entries/droopy-binding.js', 'droopy-binding.min.js');
});

gulp.task('polyfill', function() {
	browserifyAndMinify('./entries/droopy-binding.polyfill.js', 'droopy-binding.polyfill.min.js');
});
gulp.task('default', ['standard', 'polyfill']);