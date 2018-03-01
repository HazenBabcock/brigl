#!/usr/bin/env python
"""
Load all the standard examples to check that they are not broken.
"""
import time
import sys

import selenium
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select
from selenium.webdriver.support.ui import WebDriverWait

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

def test_load_by_url():
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "url.html")
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

def test_rotating():
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "rotate.html")
    log = www_driver.find_element_by_id("logarea")

    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.text):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    driver.noSevereErrors(www_driver)
    time.sleep(1.0)
    www_driver.close()    

def test_jquery():
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "jquery.html")
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

def test_error_handling():
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "error.html")

    worked = False
    try:
        WebDriverWait(www_driver, 3).until(EC.alert_is_present(),
                                           'Timed out waiting for PA creation ' +
                                           'confirmation popup to appear.')

        alert = www_driver.switch_to.alert
        alert.accept()
        worked = True
        
    except TimeoutException:
        pass

    assert worked, "Alert handling failed."
    www_driver.close()    

def test_upload():
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "upload.html")
    log = www_driver.find_element_by_id("log")

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
    test_load_by_url()
    test_rotating()
    test_jquery()
    test_error_handling()
    test_upload()
