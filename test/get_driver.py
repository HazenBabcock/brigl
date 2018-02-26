#!/usr/bin/env python
"""
This should returns an automated web browser to use for automated testing.

https://www.seleniumhq.org/
http://selenium-python.readthedocs.io/
"""
import time

from selenium import webdriver
from selenium.webdriver.common.keys import Keys


def getDriver():
    """
    This is configured to use Chrome, change as desired.
    """
    options = webdriver.ChromeOptions()
    options.add_argument("--window-size=1000,1000")

    driver = webdriver.Chrome(executable_path="./chromedriver",
                              chrome_options = options)

    return driver
