// tenant_id: 387054364856091158
// brands_id: 387054364856156694
// admin_id: 387042197582840342
// email: yohansyah.cahya+4@sirclo.com
// psswrd: Admin-123

const {
  customerId: custoId,
  customerEmail: custoEmail,
  customerOrder: custoOrder,
  customerOrders: custoOrders,
  currency: curr,
  brandId: brId,
  scv2Url: scv2Urls,
  scv2FOUrl: scv2FOUrl,
  scv2BOUrl: scv2BOUrls,
  pK: pKs,
  scv2Key: scv2Keys,
  scv2Endpoint,
//   isGuestCheckout: isGuestCheckouts, 
  loginUrl: loginUrls,
  isLoginRequired: isLoginRequireds,
  totalItems: totalItemsStaging,
} = window.scvData;

async function fetchCartData() {
  const fetchData = await fetch("/cart.js");
  const response = await fetchData.json();

  return response;
}

async function fetchProductDataStaging() {
  const productUrl = `${window.Shopify.routes.root}${window.location.pathname.replace('/', '')}.js`;
  const fetchData = await fetch(productUrl);
  const response = await fetchData.json();

  return response;
}

async function updateCartData(params) {
  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify(params),
  };
  const fetchData = await fetch("/cart/change.js", options);
  const response = await fetchData.json();

  return response;
}

async function alsoLoginScv2() {
  const query = `mutation login($key: String!) {
    loginByKey(key: $key) {
      token
    }
  }`;

  const params = {
    query,
    variables: {
      key: scv2Keys,
    },
  };
  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(params),
  };

  const fetchData = await fetch(scv2BOUrls, options);
  const responseData = await fetchData.json();

  return responseData;
}

// async function shopifyCreateCartStaging(data) {
//   const query = `mutation shopifyCreateCart($input: shopifyCreateCartInput!) {
//     shopifyCreateCart(input: $input) {
//       id
//     }
//   }`;

//   const items = data.items.map((item) => ({
//     qty: item.quantity,
//     variant_id: `gid://shopify/ProductVariant/${item.variant_id}`,
//   }));

//   const params = {
//     query,
//     variables: {
//       input: {
//         items,
//         customer_id: custoId,
//         brand_id: brId,
//       },
//     },
//   };

//   const options = {
//     method: "post",
//     headers: {
//       "Content-Type": "application/json",
//       Accept: "application/json",
//     },
//     body: JSON.stringify(params),
//   };

//   const fetchData = await fetch(`${scv2Urls}/graphql`, options);
//   const responseData = await fetchData.json();

//   return responseData;
// }

async function createCartStaging(data) {
  const query = `mutation createCart($input: CreateCartInput) {
    createCart(input: $input) {
      id
    }
  }`;

  const items = data.items.map((item) => ({
    qty: item.quantity,
    id: CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(`gid://shopify/ProductVariant/${item.variant_id}`)),
  }));
  
  const inputObj = {};
  if (data?.items_subtotal_price) {
    const subtotal = data.items_subtotal_price.toString().slice(0, -2);
    inputObj.subtotal = parseInt(subtotal);
  }
  
  const params = {
    query,
    variables: {
      input: {
        customer_id: custoId,
        brand_id: brId,
        ...inputObj,
        items,
      },
    },
  };

  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(params),
  };

  const fetchData = await fetch(`${scv2Urls}/graphql`, options);
  const responseData = await fetchData.json();

  return responseData;
}

async function alsoGetConfig() {
  const {
    data: { loginByKey: loginRes },
  } = await alsoLoginScv2();

  const query = `query getConfiguration($brandId: String!) {
    getConfiguration(brandId: $brandId) {
      ecpToken
    }
  }`;

  const params = {
    query,
    variables: {
      brandId: brId,
    },
  };
  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: loginRes.token,
    },
    body: JSON.stringify(params),
  };

  const fetchData = await fetch(scv2BOUrls, options);
  const responseData = await fetchData.json();

  return responseData;
}

async function alsoSwiftCheckout(data = {}, isSubscribe = false) {
    if (isLoginRequireds && !custoId) {
        window.location.href = loginUrl;
    } else {
        // const cartData = await fetchCartData();
        const cartData = Object.keys(data).length === 0 ? await fetchCartData() : data;
        // const checkoutData = await shopifyCreateCartStaging(cartData);
        const checkoutData = await createCartStaging(cartData);
    
        const payload = {
        ecp_token: btoa(custoId),
        brand_id: brId,
        cart_id: checkoutData.data.createCart.id,
        // cart_id: checkoutData.data.shopifyCreateCart.id,
        currency: curr,
        email: custoEmail,
        isLogin: !!custoId,
          isSubscribe,
          totalItems: totalItemsStaging,
        };
    
        try {
        var key = CryptoJS.enc.Utf8.parse(pKs);
        var iv = CryptoJS.enc.Utf8.parse(pKs.substr(0, 16));
        var encrypted = CryptoJS.AES.encrypt(JSON.stringify(payload), key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
        });
        encrypted = encodeURIComponent(encrypted.toString(CryptoJS.enc.base64));
    
        //     window.open(`${scv2Urls}/authentication?state=` + encrypted, "_self");
         window.open(`${scv2FOUrl}/authentication?state=` + encrypted, "_self");
        } catch (e) {
        console.log("error", e);
        }
    }
}

async function alsoPaymentRetry() {
    const query = `query paymentRetry($brand_id: String!, $order_id: String!) {
        paymentRetry(brand_id: $brand_id, order_id: $order_id) {
            paymentLink
            paymentToken
            vaNumber
        }
    }`;

    const params = {
        query,
        variables: {
            brand_id: brId,
            order_id: custoOrder.id,
        },
    };
    const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      // Authorization: loginRes.token,
    },
    body: JSON.stringify(params),
  };

  const fetchData = await fetch(`${scv2Urls}/graphql`, options);
  const responseData = await fetchData.json();
    return responseData;
}

// async function alsoSwiftCheckout() {
//   const cartData = await fetchCartData();
//   const checkoutData = await shopifyCreateCart(cartData);

//   const payload = {
//     ecp_token: btoa(custoId),
//     brand_id: brId,
//     cart_id: checkoutData.data.shopifyCreateCart.id,
//     currency: curr,
//     email: custoEmail,
//     isLogin: !!custoId,
//   };

//   try {
//     var key = CryptoJS.enc.Utf8.parse(pKs);
//     var iv = CryptoJS.enc.Utf8.parse(pKs.substr(0, 16));
//     var encrypted = CryptoJS.AES.encrypt(JSON.stringify(payload), key, {
//       iv: iv,
//       mode: CryptoJS.mode.CBC,
//     });
//     encrypted = encodeURIComponent(encrypted.toString(CryptoJS.enc.base64));

//     //     window.open(`${scv2Url}/authentication?state=` + encrypted);
//     window.open(`${scv2Urls}/authentication?state=` + encrypted, "_self");
//   } catch (e) {
//     console.log("error", e);
//   }
// }

/* Override Order Detail */
// {
//     if (pageType === 'customers/order') {
//         async function iterateChildren(element) {
//             if (element.children && element.children.length > 0) {
//                 for (let i = 0; i < element.children.length; i++) {
//                     if (element.children[i].textContent.indexOf(custOrder.id) !== -1) {
//                         if (element.children[i].children.length === 0) {
//                             const orderIdElement = element.children[i];
//                             const clonedOrderIdElement = orderIdElement.cloneNode(true);
//                             const containerDiv = document.createElement('div');
//                             containerDiv.style.cssText = `
//                                 display: flex;
//                                 justify-content: space-between;
//                             `;

//                             const linksContainer = document.createElement('div');
//                             linksContainer.style.cssText = `
//                                 display: flex;
//                                 justify-content: space-between;
//                                 align-items: center;
//                             `;
//                             linksContainer.innerHTML = `
//                                 <a href="${getTrackOrderUrl(custOrder.id)}" style="text-decoration: underline; text-underline-offset: 0.3em; ${
//                                 custOrder.fulfillmentStatus === 'fulfilled' ? 'margin-right: 15px;' : 'margin-right: 15px;'
//                             }">Tracking Stagg</a>
//                             `;

//                             if (rmaIsEnabled && custOrder.fulfillmentStatus === 'fulfilled') {
//                                 let returnUrl;
//                                 const config = await getConfig();
//                                 if (
//                                     config.data &&
//                                     config.data.getConfiguration &&
//                                     config.data.getConfiguration.omsUrl &&
//                                     config.data.getConfiguration.omsChannelCode
//                                 ) {
//                                     const { omsChannelCode, omsUrl } = config.data.getConfiguration;
//                                     const encodedQuerystring = `email=${encodeURIComponent(customerEmail)}&channel_code=${encodeURIComponent(
//                                         omsChannelCode
//                                     )}&order_number=${encodeURIComponent(custOrder.id)}&from=${encodeURIComponent(window.location.origin)}`;
//                                     returnUrl = `${omsUrl}omsrma/request/index/?${encodedQuerystring}`;
//                                 }

//                                 linksContainer.innerHTML += `
//                                     <a href="${returnUrl}" style="text-decoration: underline; text-underline-offset: 0.3em;">Return</a>
//                                 `;
//                             }

//                             console.log('custoOrders status', custoOrders.map((custoOrders) => custoOrders.id));
                            
//                             console.log('custoOrder', custoOrder);

//                             const custoOrdersData = custoOrders.find(({ id }) => id === custoOrder.id);
//                             console.log('data find dev', custoOrdersData);
//                             if (custoOrdersData.fulfillmentStatus === 'unfulfilled' && custoOrdersData.fulfillmentStatusLabel === 'Pending') {
//                                 console.log('udah pakai custoOrdersData , masukk pak eko')
//                                 let urlPaymentRetry;
//                                 const paymentRetryData = await alsoPaymentRetry();
//                                 if (paymentRetryData.data && paymentRetryData.data.paymentRetry) {
//                                   const { paymentLink } = paymentRetryData.data.paymentRetry;
//                                   urlPaymentRetry = paymentLink;
//                                 }

//                                 console.log('isi url', urlPaymentRetry);
//                               linksContainer.innerHTML += `
//                                     <a href="${urlPaymentRetry}" style="text-decoration: underline; text-underline-offset: 0.3em;">Pay</a>
//                                 `;
//                             }
                            
//                             for (let i = 0; i < linksContainer.children.length; i++) {
//                                 linksContainer.children[i].addEventListener('mouseenter', () => {
//                                     linksContainer.children[i].style.opacity = '0.7';
//                                     linksContainer.children[i].style['text-decoration-thickness'] = '0.2rem';
//                                 });
//                                 linksContainer.children[i].addEventListener('mouseleave', () => {
//                                     linksContainer.children[i].style.opacity = '1';
//                                     linksContainer.children[i].style['text-decoration-thickness'] = '0.1rem';
//                                 });
//                             }

//                             containerDiv.appendChild(clonedOrderIdElement);
//                             containerDiv.appendChild(linksContainer);
//                             orderIdElement.replaceWith(containerDiv);

//                             break;
//                         }
//                     }
//                     iterateChildren(element.children[i]);
//                 }
//             }
//         }

//         const mainElChildNodes = document.querySelector('main').childNodes;
//         mainElChildNodes.forEach((child) => {
//             iterateChildren(child);
//         });
//     }
// }


/* Override checkout button on cart page */
{
  if (window.scvData.pageType === "cart") {
    const btnCheckoutStaging = document.getElementById("checkout");
    const btnCheckoutStagingParentNode = btnCheckoutStaging.parentNode;
    const btnCheckoutStagingClone = btnCheckoutStaging.cloneNode();
    btnCheckoutStagingClone.textContent = "Checkout (Staging)";
    btnCheckoutStagingClone.classList.remove('scv2-checkout-button');
    btnCheckoutStagingClone.classList.add('scv2-checkout-button-staging');
    // btnCheckoutStagingClone.style.display = "none";
    btnCheckoutStagingClone.style.marginTop = "10px";
    btnCheckoutStagingClone.style.opacity = null;
    btnCheckoutStagingClone.removeAttribute("name");
    btnCheckoutStagingClone.onclick = () => alsoSwiftCheckout();
    btnCheckoutStagingParentNode.appendChild(btnCheckoutStagingClone);
  }

  if (window.scvData.pageType === 'product') {
    async function generateSubscribeButton() {
      const fetchProduct = await fetchProductDataStaging();

      if (fetchProduct?.tags.length > 0 && fetchProduct.tags.some((tag) => tag === 'subscription')) {
        const buyNowButton = document.querySelector('.shopify-payment-button__button');
        const parentNode = buyNowButton.parentNode;
        const cloneBuyNowButton = buyNowButton.cloneNode();
        const formContainer = document.querySelector('form input[name="form_type"][value="product"]').parentNode;
    
        parentNode.appendChild(cloneBuyNowButton);
        cloneBuyNowButton.onclick = () => {
            const variantSelector = ['input', 'select'];
            const pdpLineItems = { items: [] };
    
            /* Iterate over variants element selector, current known uses: input, select  */
            variantSelector.forEach((selector) => {
                if (formContainer.querySelector(`${selector}[name="id"]`)) {
                    pdpLineItems.items.push({
                        quantity: Number(document.querySelector('input[name="quantity"]').value),
                        variant_id: formContainer.querySelector(`${selector}[name="id"]`).value,
                    });
                }
            });
            alsoSwiftCheckout(pdpLineItems, true);
        };
        cloneBuyNowButton.textContent = 'Subscribe';
      }

    }
    generateSubscribeButton();
  }
}

// override footer
const footerBlockParent = document.querySelector(
  ".footer-block__details-content"
);
const customFooter2 = document.querySelector(
  '.footer-block__details-content a[href*="confirmpayment"]'
);
const cloneChild = customFooter2.cloneNode(true);
cloneChild.style.display = "none";
footerBlockParent.appendChild(cloneChild);
cloneChild.href = "https://scv2.gcp-staging.testingnow.me/confirmpayment";
