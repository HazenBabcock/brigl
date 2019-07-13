#!/usr/bin/env python
"""
Test the test pages.
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


# Tests are in alphabetical order.
def test_ajax_1():
    """
    This should work properly.
    """
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "test/test_ajax_1.html")
    log = www_driver.find_element_by_id("logarea")

    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.text):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    driver.noSevereErrors(www_driver, ignore_404 = ["p/3010.dat", "p/s/3010s01.dat"])
    www_driver.close()

def test_ajax_2():
    """
    This should create an alert box due to missing parts.
    """
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "test/test_ajax_2.html")
    
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

def test_jquery_1():
    """
    This should work properly.
    """
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "test/test_jquery_1.html")
    log = www_driver.find_element_by_id("logarea")

    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.text):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    driver.noSevereErrors(www_driver, ignore_404 = ["p/3010.dat", "p/s/3010s01.dat"])
    www_driver.close()

def test_jquery_2():
    """
    This should create an alert box due to missing parts.
    """
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "test/test_jquery_2.html")
    
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

def test_latlon_1():
    """
    This should work properly.

    FIXME: Does not actually test latlon rotation, just that it loads.
    """
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "test/test_latlon_1.html")
    log = www_driver.find_element_by_id("logarea")

    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.text):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    driver.noSevereErrors(www_driver, ignore_404 = ["p/3010.dat", "p/s/3010s01.dat"])
    www_driver.close()    

def test_colors_1():
    """
    This should work properly.

    FIXME: Does not actually check the colors, just that it loads.
    """
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "test/test_colors_1.html")
    log = www_driver.find_element_by_id("logarea")

    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.text):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    driver.noSevereErrors(www_driver, ignore_404 = ["p/3010.dat", "p/s/3010s01.dat"])
    www_driver.close()     

def test_margins_1():
    """
    This should work properly.

    FIXME: Does not actually check the margins, just that it loads.
    """
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "test/test_margins_1.html")
    log = www_driver.find_element_by_id("logarea")

    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.text):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    driver.noSevereErrors(www_driver, ignore_404 = ["p/3010.dat", "p/s/3010s01.dat"])
    www_driver.close()

def test_starting_matrix_1():
    """
    THREE.Matrix4().
    """
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "test/test_starting_matrix_1.html")
    log = www_driver.find_element_by_id("logarea")

    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.text):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    driver.noSevereErrors(www_driver, ignore_404 = ["p/3010.dat", "p/s/3010s01.dat"])
    www_driver.close()

def test_starting_matrix_2():
    """
    Javascript array in LDraw transform format.
    """
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "test/test_starting_matrix_2.html")
    log = www_driver.find_element_by_id("logarea")

    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.text):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    driver.noSevereErrors(www_driver, ignore_404 = ["p/3010.dat", "p/s/3010s01.dat"])
    www_driver.close()    

def test_starting_matrix_3():
    """
    String of values in LDraw transform format.
    """
    www_driver = driver.getDriver()
    www_driver.get(configure.www_root + "test/test_starting_matrix_3.html")
    log = www_driver.find_element_by_id("logarea")

    worked = False
    for i in range(20):
        if ("Model loaded successfully" in log.text):
            worked = True
            break
        time.sleep(0.5)

    assert(worked)
    driver.noSevereErrors(www_driver, ignore_404 = ["p/3010.dat", "p/s/3010s01.dat"])
    www_driver.close()    


if (__name__ == "__main__"):
    test_ajax_1()
    test_ajax_2()
    test_jquery_1()
    test_jquery_2()
    test_latlon_1()
    test_colors_1()
    test_margins_1()
    test_starting_matrix_1()
    test_starting_matrix_2()
    test_starting_matrix_3()
