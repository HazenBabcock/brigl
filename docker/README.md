
These folders contain the Dockerfiles and scripts needed to build Docker
images. Images run nginx as the web-server and contain everything necessary
to run BRIGL.

Running the standard examples:

```sh
$ docker pull brigl/std-examples
$ docker run -p 4000:80 brigl/std-examples
```
Then enter the following in your browsers address bar:

`http:/127.0.0.1:4000/brigl/index.html`

Or [click](http:/127.0.0.1:4000/brigl/index.html).
