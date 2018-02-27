#!/usr/bin/env python
"""
Load all the standard examples to check that they are not broken.
"""
import time
import sys

import configure as configure
import get_driver as getDriver

def test_simple():
    driver = getDriver.getDriver()
    driver.get(configure.www_root + "simple.html")
    log = driver.find_element_by_id("logarea")

    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.text):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    getDriver.noSevereErrors(driver)
    driver.close()

def test_multiple():
    driver = getDriver.getDriver()
    driver.get(configure.www_root + "multiple.html")
    log = driver.find_element_by_id("logarea")

    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.text):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    getDriver.noSevereErrors(driver)
    driver.close()

def test_copypaste():
    driver = getDriver.getDriver()
    driver.get(configure.www_root + "copypaste.html")
    log = driver.find_element_by_id("log")
    
    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.get_attribute("value")):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    getDriver.noSevereErrors(driver)
    driver.close()

def test_steps():
    driver = getDriver.getDriver()
    driver.get(configure.www_root + "steps.html")
    log = driver.find_element_by_id("logarea")

    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.text):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    getDriver.noSevereErrors(driver)
    driver.close()

if (__name__ == "__main__"):
    test_simple()
    test_multiple()
    test_copypaste()
    test_steps()
