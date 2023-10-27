/* eslint-disable */

/*
Swift Checkout - Shopify
v1.0.0
*/

const {
    customerId: custId,
    customerEmail,
    customerOrder: custOrder,
    customerOrders: custOrders,
    currency,
    brandId,
    scv2Url,
    scv2BOUrl,
    pK,
    scv2Key,
    pageType,
    rmaIsEnabled,
} = window.scvData;

document.addEventListener('DOMContentLoaded', function () {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js';
    document.body.appendChild(script);

    let urlParams = {};
    (window.onpopstate = function () {
        let match,
            pl = /\+/g,
            search = /([^&=]+)=?([^&]*)/g,
            decode = function (s) {
                return decodeURIComponent(s.replace(pl, ' '));
            },
            query = window.location.search.substring(1);

        while ((match = search.exec(query))) {
            if (decode(match[1]) in urlParams) {
                if (!Array.isArray(urlParams[decode(match[1])])) {
                    urlParams[decode(match[1])] = [urlParams[decode(match[1])]];
                }
                urlParams[decode(match[1])].push(decode(match[2]));
            } else {
                urlParams[decode(match[1])] = decode(match[2]);
            }
        }
    })();

    if (urlParams && urlParams.success === '1') {
        const loaderContainer = document.createElement('div');
        loaderContainer.style.cssText = `
        position: fixed;
        display: block;
        z-index: 100;
        width: 100%;
        height: 100vh;
        background-color: rgba(255, 255, 255, 0.5);
      `;
        document.body.appendChild(loaderContainer);

        fetch('/cart/clear.js', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        }).then(() => window.location.replace('/'));
    }
});

async function fetchCartData() {
    const fetchData = await fetch('/cart.js');
    const response = await fetchData.json();

    return response;
}

async function updateCartData(params) {
    const options = {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(params),
    };
    const fetchData = await fetch('/cart/change.js', options);
    const response = await fetchData.json();

    return response;
}

async function loginScv2() {
    const query = `mutation login($key: String!) {
      loginByKey(key: $key) {
        token
      }
    }`;

    const params = {
        query,
        variables: {
            key: scv2Key,
        },
    };
    const options = {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(params),
    };

    const fetchData = await fetch(scv2BOUrl, options);
    const responseData = await fetchData.json();

    return responseData;
}

async function getConfig() {
    const {
        data: { loginByKey: loginRes },
    } = await loginScv2();

    const query = `query getConfiguration($brandId: String!) {
        getConfiguration(brandId: $brandId) {
            omsUrl
            omsChannelCode
        }
    }`;

    const params = {
        query,
        variables: {
            brandId,
        },
    };
    const options = {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: loginRes.token,
        },
        body: JSON.stringify(params),
    };

    const fetchData = await fetch(scv2BOUrl, options);
    const responseData = await fetchData.json();

    return responseData;
}

async function shopifyCreateCart(data) {
    const query = `mutation shopifyCreateCart($input: shopifyCreateCartInput!) {
      shopifyCreateCart(input: $input) {
        id
      }
    }`;

    const items = data.items.map((item) => ({
        qty: item.quantity,
        variant_id: `gid://shopify/ProductVariant/${item.variant_id}`,
    }));

    const params = {
        query,
        variables: {
            input: {
                items,
                customer_id: custId,
                brand_id: brandId,
            },
        },
    };

    const options = {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(params),
    };

    const fetchData = await fetch(`${scv2Url}/graphql`, options);
    const responseData = await fetchData.json();

    return responseData;
}

async function swiftCheckout(data = {}) {
    const cartData = Object.keys(data).length === 0 ? await fetchCartData() : data;
    const checkoutData = await shopifyCreateCart(cartData);

    const payload = {
        ecp_token: btoa(custId),
        brand_id: brandId,
        cart_id: checkoutData.data.shopifyCreateCart.id,
        currency: currency,
        email: customerEmail,
        isLogin: !!custId,
    };

    try {
        var key = CryptoJS.enc.Utf8.parse(pK);
        var iv = CryptoJS.enc.Utf8.parse(pK.substr(0, 16));
        var encrypted = CryptoJS.AES.encrypt(JSON.stringify(payload), key, { iv: iv, mode: CryptoJS.mode.CBC });
        encrypted = encodeURIComponent(encrypted.toString(CryptoJS.enc.base64));

        window.open(`${scv2Url}/authentication?state=` + encrypted, '_self');
    } catch (e) {
        console.log('error', e);
    }
}

function getTrackOrderUrl(orderId) {
    const trackOrderState = btoa(orderId + '|' + brandId);
    const trackOrderUrl = `${scv2Url}/track-order/${trackOrderState}`;

    return trackOrderUrl;
}

/* Override Order History Page */
{
    async function overrideTable() {
        let returnUrl = '';
        const tbodyChildNodes = document.querySelector('tbody').childNodes;

        if (rmaIsEnabled) {
            const config = await getConfig();
            if (config.data && config.data.getConfiguration && config.data.getConfiguration.omsUrl && config.data.getConfiguration.omsChannelCode) {
                const { omsChannelCode, omsUrl } = config.data.getConfiguration;
                const encodedQuerystring = `email=${encodeURIComponent(customerEmail)}&channel_code=${encodeURIComponent(
                    omsChannelCode
                )}&order_number=[orderNumber]&from=${encodeURIComponent(window.location.origin)}`;
                returnUrl = `${omsUrl}omsrma/request/index/?${encodedQuerystring}`;
            }
        }

        tbodyChildNodes.forEach((row) => {
            for (let i = 0; i < row.children.length; i++) {
                const findOrder = custOrders.find((order) => row.children[i].textContent.indexOf(order.id) !== -1);
                const beforeLastColumnIdx = row.children.length - 2;
                const beforeLastColumn = row.children[beforeLastColumnIdx];

                if (findOrder) {
                    const orderId = findOrder.id;
                    beforeLastColumn.innerHTML = `
                        <div class="scv2-orders-links" style="display: flex; justify-content: space-between;">
                            <a href="${getTrackOrderUrl(orderId)}" style="text-decoration: underline; text-underline-offset: 0.3em;">${
                        beforeLastColumn.textContent
                    }</a>
                            ${
                                rmaIsEnabled && findOrder.fulfillmentStatus === 'fulfilled'
                                    ? `<a href="${returnUrl.replace(
                                          '[orderNumber]',
                                          encodeURIComponent(orderId)
                                      )}" style="text-decoration: underline; text-underline-offset: 0.3em;">Return</a>`
                                    : ''
                            }
                        </div>
                    `;

                    const linksContainer = document.querySelectorAll('.scv2-orders-links');
                    linksContainer.forEach((container) => {
                        for (let i = 0; i < container.children.length; i++) {
                            container.children[i].addEventListener('mouseenter', () => {
                                container.children[i].style.opacity = '0.7';
                                container.children[i].style['text-decoration-thickness'] = '0.2rem';
                            });
                            container.children[i].addEventListener('mouseleave', () => {
                                container.children[i].style.opacity = '1';
                                container.children[i].style['text-decoration-thickness'] = '0.1rem';
                            });
                        }
                    });
                }
            }
        });
    }
    if (pageType === 'customers/account') {
        /* Override Order Table */
        const hasFulfilledOrder = custOrders.some((order) => order.fulfillmentStatus === 'fulfilled');
        if (hasFulfilledOrder) {
            overrideTable();
        }

        /* Override Address */
        const addressUrl = document.querySelector('a[href="/account/addresses"]');
        addressUrl.href = `${scv2Url}/dashboard`;
    }
}

/* Override Order Detail */
{
    if (pageType === 'customers/order') {
        async function iterateChildren(element) {
            if (element.children && element.children.length > 0) {
                for (let i = 0; i < element.children.length; i++) {
                    if (element.children[i].textContent.indexOf(custOrder.id) !== -1) {
                        if (element.children[i].children.length === 0) {
                            const orderIdElement = element.children[i];
                            const clonedOrderIdElement = orderIdElement.cloneNode(true);
                            const containerDiv = document.createElement('div');
                            containerDiv.style.cssText = `
                                display: flex;
                                justify-content: space-between;
                            `;

                            const linksContainer = document.createElement('div');
                            linksContainer.style.cssText = `
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                            `;
                            linksContainer.innerHTML = `
                                <a href="${getTrackOrderUrl(custOrder.id)}" style="text-decoration: underline; text-underline-offset: 0.3em; ${
                                custOrder.fulfillmentStatus === 'fulfilled' ? 'margin-right: 15px;' : ''
                            }">Tracking</a>
                            `;
                            if (rmaIsEnabled && custOrder.fulfillmentStatus === 'fulfilled') {
                                let returnUrl;
                                const config = await getConfig();
                                if (
                                    config.data &&
                                    config.data.getConfiguration &&
                                    config.data.getConfiguration.omsUrl &&
                                    config.data.getConfiguration.omsChannelCode
                                ) {
                                    const { omsChannelCode, omsUrl } = config.data.getConfiguration;
                                    const encodedQuerystring = `email=${encodeURIComponent(customerEmail)}&channel_code=${encodeURIComponent(
                                        omsChannelCode
                                    )}&order_number=${encodeURIComponent(custOrder.id)}&from=${encodeURIComponent(window.location.origin)}`;
                                    returnUrl = `${omsUrl}omsrma/request/index/?${encodedQuerystring}`;
                                }

                                linksContainer.innerHTML += `
                                    <a href="${returnUrl}" style="text-decoration: underline; text-underline-offset: 0.3em;">Return</a>
                                `;
                            }

                            for (let i = 0; i < linksContainer.children.length; i++) {
                                linksContainer.children[i].addEventListener('mouseenter', () => {
                                    linksContainer.children[i].style.opacity = '0.7';
                                    linksContainer.children[i].style['text-decoration-thickness'] = '0.2rem';
                                });
                                linksContainer.children[i].addEventListener('mouseleave', () => {
                                    linksContainer.children[i].style.opacity = '1';
                                    linksContainer.children[i].style['text-decoration-thickness'] = '0.1rem';
                                });
                            }

                            containerDiv.appendChild(clonedOrderIdElement);
                            containerDiv.appendChild(linksContainer);
                            orderIdElement.replaceWith(containerDiv);

                            break;
                        }
                    }
                    iterateChildren(element.children[i]);
                }
            }
        }

        const mainElChildNodes = document.querySelector('main').childNodes;
        mainElChildNodes.forEach((child) => {
            iterateChildren(child);
        });
    }
}

/* Override Checkout */
{
    function createErrorContainer() {
        const errorContainer = document.createElement('div');
        errorContainer.classList.add('scv2-errors-container');
        errorContainer.style.cssText = `
            color: red;
            padding: 5px 0;
            display: none;
        `;
        return errorContainer;
    }

    async function handleCheckout(element, data = {}) {
        let elementText;
        let errorContainer = document.querySelector('div.scv2-errors-container');
        if (errorContainer) {
            errorContainer.textContent = '';
        } else {
            errorContainer = createErrorContainer();
        }

        try {
            elementText = element.textContent;
            element.textContent = 'Loading...';
            element.disabled = true;
            element.style.opacity = '0.5';
            if (Object.keys(data).length === 0) {
                await swiftCheckout();
            } else {
                await swiftCheckout(data);
            }
        } catch (e) {
            element.textContent = elementText;
            element.disabled = false;
            element.style.opacity = '1';

            const parentNode = element.parentNode;
            if (parentNode) {
                parentNode.appendChild(errorContainer);
            }
            errorContainer.textContent = 'Something went wrong. Please try again later.';
            errorContainer.style.display = 'block';
        }
    }

    /* Overrides checkout button on cart. */
    function getCheckoutButton() {
        const checkoutButton = document.querySelectorAll('button[name="checkout"]');
        const newButtonContainer = document.createElement('div');
        if (checkoutButton && checkoutButton.length > 0) {
            const lastCheckoutButton = checkoutButton[checkoutButton.length - 1];
            const buttonParentNode = lastCheckoutButton.parentNode;
            newButtonContainer.style.width = '100%';
            newButtonContainer.appendChild(lastCheckoutButton);
            buttonParentNode.appendChild(newButtonContainer);

            lastCheckoutButton.type = 'button';
            lastCheckoutButton.disabled = false;
            lastCheckoutButton.removeAttribute('aria-disabled');
            lastCheckoutButton.style.opacity = '1';
            lastCheckoutButton.onclick = () => handleCheckout(lastCheckoutButton);
        }
    }
    getCheckoutButton();

    /*
    Handles cart:refresh events on some pages (current known page: /cart), when using Prestige theme,
    by manually checking whether added "data-rerendercart" attribute exist, value can be whatever, is set to false,
    if it doesn't exist, then it has rerendered at least once.
    */
    document.addEventListener('cart:refresh', async () => {
        const checkoutButton = document.querySelector('button[name="checkout"]');
        if (checkoutButton) {
            checkoutButton.setAttribute('data-rerendercart', 'false');
        }

        async function rerenderCart() {
            return new Promise((resolve) => {
                const cartRerenderInterval = setInterval(() => {
                    const rerenderedCheckoutButton = document.querySelector('button[name="checkout"]');
                    if (rerenderedCheckoutButton) {
                        rerenderedCheckoutButton.disabled = true;
                        rerenderedCheckoutButton.setAttribute('aria-disabled', true);
                        rerenderedCheckoutButton.style.opacity = '0.5';

                        if (!rerenderedCheckoutButton.hasAttribute('data-rerendercart')) {
                            getCheckoutButton();
                            resolve();
                            clearInterval(cartRerenderInterval);
                        }
                    }
                }, 200);
            });
        }
        await rerenderCart();

        /* Listens to DOM changes when mini-cart updates after changing quantity and adding product to cart. */
        const miniCart = document.getElementById('sidebar-cart');
        if (miniCart) {
            const observer = new MutationObserver(function (mutations) {
                mutations.forEach(async (mutation) => {
                    if (mutation.addedNodes.length > 0) {
                        await rerenderCart();
                    }
                });
            });
            observer.observe(miniCart, { attributes: true, childList: true, characterData: true });
        }
    });

    /* Overrides buy now button on PDP. */
    const paymentButton = document.querySelector('div[data-shopify="payment-button"]');
    if (paymentButton) {
        paymentButton.style.display = 'none';
        const paymentButtonParentNode = paymentButton.parentNode;
        const buynowButton = document.querySelector('div[data-shopify="payment-button"] button');
        if (buynowButton) {
            const buttonClone = buynowButton.cloneNode();
            if (buttonClone.classList.contains('shopify-payment-button__button--hidden')) {
                buttonClone.classList.remove('shopify-payment-button__button--hidden');
            }
            buttonClone.type = 'button';
            buttonClone.classList.add(paymentButton.classList);
            buttonClone.disabled = false;
            buttonClone.textContent = 'Buy it Now';
            buttonClone.onclick = () => {
                const variantSelector = ['input', 'select'];
                const pdpLineItems = { items: [] };

                /* Iterate over variants element selector, current known uses: input, select  */
                variantSelector.forEach((selector) => {
                    if (document.querySelector(`${selector}[name="id"]`)) {
                        pdpLineItems.items.push({
                            quantity: Number(document.querySelector('input[name="quantity"]').value),
                            variant_id: document.querySelector(`${selector}[name="id"]`).value,
                        });
                    }
                });
                handleCheckout(buttonClone, pdpLineItems);
            };

            const buttonContainer = document.createElement('div');
            buttonContainer.appendChild(buttonClone);

            paymentButtonParentNode.appendChild(buttonContainer);
            paymentButton.remove(); // remove the original button
        }
    }
}
