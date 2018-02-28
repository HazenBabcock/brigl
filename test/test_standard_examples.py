#!/usr/bin/env python
"""
Load all the standard examples to check that they are not broken.
"""
import time
import sys

import selenium
from selenium.webdriver.support.ui import Select

import configure as configure
import driver as driver


# Tests are in the order of the examples on the index.html page.
#
def test_simple():
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "simple.html")
    log = www_driver.find_element_by_id("logarea")

    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.text):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    driver.noSevereErrors(www_driver)
    www_driver.close()

def test_multiple():
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "multiple.html")
    log = www_driver.find_element_by_id("logarea")

    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.text):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    driver.noSevereErrors(www_driver)
    www_driver.close()

def test_copypaste():
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "copypaste.html")
    log = www_driver.find_element_by_id("log")
    
    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.get_attribute("value")):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    driver.noSevereErrors(www_driver)
    www_driver.close()

def test_steps():
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "steps.html")
    log = www_driver.find_element_by_id("logarea")

    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.text):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    driver.noSevereErrors(www_driver)
    www_driver.close()

def test_lines():
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "lines.html")
    log = www_driver.find_element_by_id("logarea")

    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.text):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    driver.noSevereErrors(www_driver)
    www_driver.close()

def test_animation():
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "anim.html")
    log = www_driver.find_element_by_id("logarea")
    select = Select(www_driver.find_element_by_xpath("/html/body/select[1]"))

    for option in select.options:
        option.click()

        worked = False
        for i in range(20):
            if ("Model loaded successfully" in log.text):
                worked = True
                break
            time.sleep(0.5)
        
        assert(worked)
        driver.noSevereErrors(www_driver)
        
    www_driver.close()       

if (__name__ == "__main__"):
    test_simple()
    test_multiple()
    test_copypaste()
    test_steps()
    test_lines()
    test_animation()
    
    
