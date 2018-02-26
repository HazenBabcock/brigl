#!/usr/bin/env python
"""
Load all the standard examples to check that they are not broken.
"""
import time
import sys

import configure as configure
import get_driver as getDriver

examples = ["simple.html",
            "multiple.html",
            "copypaste.html"]

def test_examples():
    driver = getDriver.getDriver()
    for example in examples:
        driver.get(configure.www_root + example)
        log = driver.find_element_by_id("logarea")

        worked = False
        for i in range(20):
            if ("Model loaded successfully" in log.text):
                worked = True
                break
            time.sleep(0.5)

        print(log.text)
        assert(worked)
    driver.close()


if (__name__ == "__main__"):
    test_examples()
    
