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
        
