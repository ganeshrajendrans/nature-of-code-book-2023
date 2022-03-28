const pkg1 = require('@notionhq/client');
const axios =  require('axios');
const fs = require('fs')
const tagmaps = require('./tagmaps')
const { Client } = pkg1;

const DESTINATION_FOLDER = './../src/chapter-content';
const IMAGE_REPO = 'noc-book-2/context/noc_html/imgs/';
//const { NOTION_TOKEN } = process.env;
const NOTION_TOKEN  = "secret_X0gL291bcfyjZxXx5elwH4YAPsC9JQ3F7qiBO4tTKfn";
const TEXT_TYPES = ['paragraph','heading_1','heading_2','heading_3','bulleted_list_item'];
const BLOCK_NAME = "Content";
let notion;
let contentArray = [];
let string = '';

async function getPageUpdates() {
    console.log('fetching notion content');
    let response = await notion.search({
        query:BLOCK_NAME
    });
    if(response.results && response.results.length) {
        let blockId = response.results[0].id;
        await getBlockContent(blockId,false,BLOCK_NAME);
        await updateDoc();
        //updateImages();
    } else {
        console.log('no data found for block:',BLOCK_NAME);
    }
    
}
async function getBlockContent(id,isChild,name) {
    let pageblock = await notion.blocks.children.list({
        block_id: id
    });
    if(isChild) {
        return pageblock;
    } else {
        let string = '';
        await parseBlockContent(pageblock.results,string);
        if(string != '' && name) {
            contentArray.push({
                string:string,
                base:name
            })
            string = '';
        }
    }

}
async function parseBlockContent(pageblock,str) {
    /**
     handling bulleted lists separately as the items do not come bundled
     */
    if(pageblock && pageblock.length) {
        for(let i=0;i<pageblock.length;i++) {
            let obj = pageblock[i];
            if(obj.type == 'child_page') {
                await getBlockContent(obj.id,false,obj[obj.type].title);
            } else {
                if(obj[obj.type]) {
                    //console.log(obj)
                    if(TEXT_TYPES.indexOf(obj.type) != -1) {
                        textToHtml(obj[obj.type],obj.type)
                    }
                    if(obj.type == 'callout') {
                        if(obj['has_children']) {
                            let child = await getBlockContent(obj.id,true,'');
                            obj[obj.type]['children'] = child?.results
                        }
                        calloutToHtml(obj[obj.type],obj.type)
                    }
                    if(obj.type == 'code') {
                        codeToHtml(obj[obj.type],obj.type)
                    }
                    if(obj.type == 'equation') {
                        equationToHtml(obj[obj.type],obj.type)
                    }
                    if(obj.type == 'image') {
                        //imgToHtml(obj[obj.type],obj.type)
                    }
                }
                
            }
        }
        //return string;
    }
}
/*
    Get page content
    check if child page exists. Get child page content. 
    then form block content from notion(a)
    if blocks have children recall (a)
    when all blocks are done 
    create the page 
    
 */

/**
 utils functions to parse data from different types of blocks
 */    
function textToHtml(typeObj,type) {
    let text = typeObj.text;
    let {tagStack,html} = setOpeningTags('text',type);
    let blockString = html;
    /*links and annotations
    //bold/italic/code/strikethrough/equation*/
    text.forEach((txt) => {
        let innertags = []
        if(txt['href']) {
            blockString += `<a href=${txt['href']}>`;
            innertags.push('a');
        }
        if(txt['annotations'].italic) {
            blockString += `<i>`;
            innertags.push('i');
        }
        if(txt['annotations'].bold) {
            blockString += `<b>`;
            innertags.push('b');
        }
        if(txt['annotations'].code) {
            blockString += `<code>`;
            innertags.push('code');
        }
        if(txt['annotations'].strikethrough) {
        }
        //pop from stack with closing tags 
        blockString += txt['plain_text'];
        if(innertags.length) {
            blockString += setClosingTags(innertags);
        }
    })
    blockString += setClosingTags(tagStack);
}
function calloutToHtml(typeObj) {
    let calloutString = ''
    let calloutType = typeObj.icon.emoji;
    let tags = setOpeningTags('callouts',calloutType);
    /**
     * Extra condition because notion does not handle heading beyong h3
     */
    if(typeObj?.text?.[0]?.['plain_text']) {
        calloutString = `<h6> typeObj?.text?.[0]?.['plain_text'] </h6>`
    }
    parseBlockContent(typeObj?.children);
}
function equationToHtml(typeObj) {
    let {tagStack,html} = setOpeningTags('equation','basic');
    let blockString = html;
    blockString += `${typeObj.expression.toString()}`;
    blockString += setClosingTags(tagStack);
}
function codeToHtml(typeObj) {
    let {tagStack,html} = setOpeningTags('code','javascript');
    let blockString = html;
    let code = typeObj?.text?.[0]?.text?.content;
    blockString += `${code}`;
    blockString += setClosingTags(tagStack);
}

/**
 * HTML Tag utils
 */
function setOpeningTags(type,subtype) {
    let tagObj = tagmaps[type][subtype];
    let tagStack = [];
    let htmlString = ''
    tagObj.forEach(obj => {
        let currentTag = `<${obj.tag}`
        tagStack.push(obj.tag)
        if(obj.attributes) {
            for(val in obj.attributes) {
                /**
                 * if variable attribte: Replace here
                 */
                if(obj.attributes[val].indexOf('$') != -1) {
                } else {
                    currentTag += ` ${val}="${obj.attributes[val]}"`
                }
            }
        }
        currentTag += `> \n`
        htmlString += currentTag
    })
    return {
        tagStack: tagStack,
        html:htmlString
    }

}
function setClosingTags(tagStack) {
    let html=''
    tagStack.reverse().forEach(tag => {
        html += ` </${tag}> `
    })
    return html;
}

/**
 write to repo functions
 */
async function updateDoc() {
    for (let i = 0; i < contentArray.length; i++) {
        addFiles(contentArray[i].base,contentArray[i].string)
    }
}

async function addFiles(name,content) {
    const filePath = `${DESTINATION_FOLDER}`;

    console.log('Creating directory', filePath);
    fs.mkdirSync(filePath, { recursive: true }, () => {});

    const fileContents = content.toString('base64');
    const fileName = `${name}.html`;
    console.log('Creating file', fileName);
    fs.writeFileSync(`${filePath}/${fileName}`, fileContents);
}

async function onStart() {
    console.log('NOTION_TOKEN',NOTION_TOKEN)
    notion = new Client({ auth: NOTION_TOKEN })
    console.log(`Deleting ${DESTINATION_FOLDER}`);
    fs.rmdirSync(DESTINATION_FOLDER, { recursive: true });

    console.log(`Creating ${DESTINATION_FOLDER}`);
    fs.mkdirSync(DESTINATION_FOLDER, {});
    getPageUpdates();
}
onStart()