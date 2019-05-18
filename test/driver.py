#!/usr/bin/env python
"""
This returns an automated web browser to use for automated testing. It also 
includes some utility functions.

https://www.seleniumhq.org/
http://selenium-python.readthedocs.io/
"""
import time

from selenium import webdriver
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities  


# Web browser interface.
def getDriver():
    """
    This is configured to use Chrome, change as desired.
    """
    desired = DesiredCapabilities.CHROME
    desired['loggingPrefs'] = {'browser' : 'ALL'}
    
    options = webdriver.ChromeOptions()
    options.add_argument("--window-size=1000,1000")

    driver = webdriver.Chrome(executable_path="./chromedriver",
                              desired_capabilities = desired,
                              chrome_options = options)

    return driver


# Utility functions.

class BRIGLTestException(Exception):
    pass

def noSevereErrors(driver, ignore_404 = []):
    """
    ignore_404 - A list of files for which it is okay if they are missing.
    """
    ignore_404.append("favicon.ico")
    
    log_data = driver.get_log('browser')
    severe_errors = parseLog(log_data)
    if (len(severe_errors) > 0):
        
        is_severe = False
        for s_err in severe_errors:
            is_ignored = False
            for i_404 in ignore_404:
                if (i_404 in s_err['message']):
                    is_ignored = True
                    break
            if not is_ignored:
                is_severe = True
                break
            
        if is_severe:
            print("Severe error(s) detected:")
            for elt in severe_errors:
                print(elt)
            raise BRIGLTestException("Severe error(s) detected.")

def parseLog(log_data, level = 'SEVERE'):
    """
    Return only those messages with the specified level.
    """
    temp = []
    for elt in log_data:
        if (elt['level'] == level):
            temp.append(elt)
    return temp

def pprintLog(log_data):
    """
    Pretty print log messages.
    """
    for elt in log_data:
        print(elt)
        
