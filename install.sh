#
# This installs the html and javascript. It does not install the
# parts. It is primarily designed to make it easy to update the
# server code during development.
#
readonly www_dir=/usr/share/nginx/html/brigl

cp -r web/*.html $www_dir/.
cp -r web/js/*.js $www_dir/js/.

cp -r test/p $www_dir/test/.
cp -r test/parts $www_dir/test/.
cp -r test/*.html $www_dir/test/.
