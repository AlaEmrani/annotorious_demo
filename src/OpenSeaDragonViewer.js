import OpenSeadragon, { parseJSON } from "openseadragon";
import * as Annotorious from '@recogito/annotorious-openseadragon';
import '@recogito/annotorious-openseadragon/dist/annotorious.min.css';
import * as SelectorPack from "@recogito/annotorious-selector-pack";
import {ColorSelectorWidget, ColorFormatter} from "./ManualEditor";
import * as svgOverlay from "./openseadragon-svg-overlay"
import * as d3 from "d3"


import React, { useEffect, useState } from "react";

const OpenSeaDragonViewer = ({ image }) => {
  const [viewer, setViewer] = useState( null);
  const [anno, setAnno] = useState(null)
  
useEffect(() => {
    if (image && viewer) {
      viewer.open(image.source);
    }
    if (image && anno){
        InitAnnotations()
    }
  }, [image]);

const InitOpenseadragon = () => {
    viewer && viewer.destroy();
    let startPoint, endPoint, firstScale;
    let drag = false;
    
    const initViewer = OpenSeadragon({
        id: "openSeaDragon",
        prefixUrl: "openseadragon-images/",
        animationTime: 0.5,
        blendTime: 0.1,
        constrainDuringPan: true,
        maxZoomPixelRatio: 2,
        minZoomLevel: 1,
        visibilityRatio: 1,
        zoomPerScroll: 2,
        gestureSettingsMouse: {clickToZoom: false, dblClickToZoom: true},
    })
    let overlay = initViewer.svgOverlay();

    initViewer.addHandler('zoom', () =>{
        drag = false;
        d3.selectAll('line').remove();
        d3.selectAll('rect.infoRect').remove();
        d3.selectAll('text').remove();
    })

    initViewer.addHandler('open', () =>{
        firstScale = currentScale();
    })

    let currentScale = () => {
        const containerWidth = initViewer.viewport.getContainerSize().x;
        const zoom = initViewer.viewport.getZoom(true);
        return zoom * containerWidth / initViewer.world.getContentFactor();
    }

    initViewer.addHandler('canvas-press', (event) => {
        drag = !drag;
        startPoint = initViewer.viewport.pointFromPixel(event.position);
        console.log('press', startPoint, drag);
        if (!drag){
            d3.selectAll('line').remove();
            d3.selectAll('rect.infoRect').remove();
            d3.selectAll('text').remove();
        }
    });

    new OpenSeadragon.MouseTracker({
        element: initViewer.container,
        moveHandler: (event) => {
            if (drag) {
                const strk_width = (firstScale*.005)/currentScale();
                const fontSize = (firstScale*.015)/currentScale();
                const rect_size = strk_width * 10
                endPoint = initViewer.viewport.pointFromPixel(event.position);
                const middlePoint = {'x': (startPoint.x + endPoint.x)/2,
                                      'y': (startPoint.y + endPoint.y)/2}
                const perpendicularSlope = -(endPoint.x - startPoint.x)/(endPoint.y - startPoint.y)
                const rectInfoDist = {'x': strk_width, 'y': strk_width*perpendicularSlope}
                const lineLength = Math.round(100*Math.sqrt((endPoint.x - startPoint.x)**2 +
                    (endPoint.y - startPoint.y)**2)) /100

                d3.selectAll('line').remove();
                d3.selectAll('rect.infoRect').remove();
                d3.selectAll('text').remove();
                let ruler = d3.select(overlay.node()).append("line")
                        .attr('x1', endPoint.x)
                        .attr('y1', endPoint.y)
                        .attr('x2', startPoint.x)
                        .attr('y2', startPoint.y)
                        .attr('stroke', 'red')
                        .attr('stroke-width', strk_width.toString());


                d3.select(overlay.node()).append('text')
                    .attr('x', middlePoint.x + rectInfoDist.x)
                    .attr('y', middlePoint.y  + (rectInfoDist.y - .1)*rect_size)
                    .attr('fill', 'black')
                    .style("font-size", fontSize)
                    .text(lineLength.toString());


            }
        },

    });


    setViewer(initViewer);
    const config = {
        widgets: [
            ColorSelectorWidget,
            'COMMENT',
            'TAG'
        ],
        formatter: ColorFormatter,
    };
    let annotate = Annotorious(initViewer, {});

    annotate.on('mouseEnterAnnotation', function(annotation, event) {
        console.log(annotation);
    });
    SelectorPack(annotate, {});
    annotate.setDrawingTool('point');
    console.log(annotate.listDrawingTools());
    setAnno(annotate)
  };

  const [annotations, setAnnotations] = useState([])

const InitAnnotations = async() => {

    const storedAnnoatations = getLocalAnnotations
    if (storedAnnoatations) {
        const annotations = parseJSON(storedAnnoatations)
        setAnnotations(annotations)
        anno.setAnnotations(annotations);

    }

    anno.on('createAnnotation', (annotation) => {
        const newAnnotations = [...annotations, annotation]
        setAnnotations(newAnnotations)
        setLocalAnnotation(newAnnotations)
        viewer.gestureSettingsMouse = {clickToZoom: false, dblClickToZoom: true};

    });

    anno.on('updateAnnotation', (annotation, previous) => {
        const newAnnotations = annotations.map(val => {
            if (val.id === annotation.id) return annotation
            return val
        })
        setAnnotations(newAnnotations)
        setLocalAnnotation(newAnnotations)
    });

    anno.on('deleteAnnotation', (annotation) => {
        const newAnnotations  = annotations.filter(val => val.id !== annotation.id)
        setAnnotations(newAnnotations)
        setLocalAnnotation(newAnnotations)
    });

    anno.on('mouseEnterAnnotation', function(annotation, event) {
        console.log(annotation);
    });
}

const getLocalAnnotations =  () => {
    return localStorage.getItem(image.source.Image.Url) 
}

const setLocalAnnotation = (newAnnotations) => {
    localStorage.setItem(image.source.Image.Url, JSON.stringify(newAnnotations)) 
}

useEffect(() => {
    InitOpenseadragon();
    return () => {
        viewer && viewer.destroy();
    };
  }, []);
return (
  <div 
  id="openSeaDragon" 
  style={{
    height: "800px",
    width: "1200px"
  }}
  >
  </div>
  );
};
export { OpenSeaDragonViewer };