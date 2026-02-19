#!/usr/bin/env python3
"""
TIPS Data Flow Diagram (DFD) - Vertical Layout (A4)
Graphviz, fixed alignment, stages in one horizontal row
"""

from graphviz import Digraph


def draw_dfd():
    dot = Digraph(comment='TIPS Data Flow Diagram')

    dot.attr(
        rankdir='TB',
        size='8.27,11.69!',
        ratio='compress',
        margin='0.25',
        dpi='300'
    )

    dot.attr(
        'node',
        shape='box',
        style='rounded,filled',
        fillcolor='white',
        fontname='Helvetica',
        fontsize='10'
    )

    dot.attr('edge', fontname='Helvetica', fontsize='9')

    # External entities
    with dot.subgraph() as s:
        s.attr(rank='same')
        s.node('Interviewer', 'Interviewer\n(External Entity)',
               shape='ellipse', fillcolor='#f5f5f5', fontsize='11')
        s.node('Candidate', 'Candidate\n(External Entity)',
               shape='ellipse', fillcolor='#f5f5f5', fontsize='11')

    # Web UI
    dot.node('WebUI', 'Web UI Layer\n(Recording Interface)',
             shape='folder', style='dashed', fillcolor='#fafafa', fontsize='11')

    dot.edge('Interviewer', 'WebUI', label='Audio')
    dot.edge('Candidate', 'WebUI', label='Audio/Video')

    # Media storage
    dot.node('MediaStorage', 'Media Storage',
             shape='folder', style='dashed', fillcolor='#fafafa', fontsize='11')

    dot.edge('WebUI', 'MediaStorage', label='Recording Files')

    # Media files
    with dot.subgraph() as s:
        s.attr(rank='same')
        s.node('IntAudio', 'interviewer_audio.wav', shape='note', fontsize='8')
        s.node('CandAudio', 'candidate_audio.wav', shape='note', fontsize='8')
        s.node('CandVideo', 'candidate_video.mp4', shape='note', fontsize='8')

    dot.edge('MediaStorage', 'IntAudio', arrowhead='none')
    dot.edge('MediaStorage', 'CandAudio', arrowhead='none')
    dot.edge('MediaStorage', 'CandVideo', arrowhead='none')

    # Pipeline
    dot.node('Pipeline', 'Backend Pipeline\n(6-Stage Processing)',
             shape='folder', style='dashed', fillcolor='#fafafa', fontsize='11')

    dot.edge('IntAudio', 'Pipeline')
    dot.edge('CandAudio', 'Pipeline')
    dot.edge('CandVideo', 'Pipeline')

    # JD
    with dot.subgraph() as s:
        s.attr(rank='same')
        s.node('JD', 'JD\n(Job Description)',
               shape='cds', fillcolor='#fffde7', fontsize='9')

    dot.edge('JD', 'Pipeline', style='dashed', label='input', fontsize='7')

    # =====================
    # PIPELINE STAGES — ONE HORIZONTAL ROW
    # =====================
    with dot.subgraph() as s:
        s.attr(rank='same')
        s.node('Stage0', 'Stage 0\nTimebase', fontsize='7')
        s.node('Stage1', 'Stage 1\nExtraction', fontsize='7')
        s.node('Stage2', 'Stage 2\nTemporal', fontsize='7')
        s.node('Stage3', 'Stage 3\nBehavior', fontsize='7')
        s.node('Stage4', 'Stage 4\nSemantic', fontsize='7')
        s.node('Stage5', 'Stage 5\nAggregation', fontsize='7')

    # Lock horizontal order
    dot.edge('Stage0', 'Stage1', style='invis')
    dot.edge('Stage1', 'Stage2', style='invis')
    dot.edge('Stage2', 'Stage3', style='invis')
    dot.edge('Stage3', 'Stage4', style='invis')
    dot.edge('Stage4', 'Stage5', style='invis')

    # ✅ Visible stage flow
    dot.edge('Stage0', 'Stage1')
    dot.edge('Stage1', 'Stage2')
    dot.edge('Stage2', 'Stage3')
    dot.edge('Stage3', 'Stage4')
    dot.edge('Stage4', 'Stage5')

    # Visual cluster
    with dot.subgraph(name='cluster_stages') as c:
        c.attr(style='dotted')
        c.node('Stage0')
        c.node('Stage1')
        c.node('Stage2')
        c.node('Stage3')
        c.node('Stage4')
        c.node('Stage5')

    dot.edge('Pipeline', 'Stage0')

    # Output
    dot.node('OutputArtifacts', 'Output Artifacts\n(JSON)',
             shape='folder', style='dashed', fillcolor='#fafafa', fontsize='11')

    dot.edge('Stage5', 'OutputArtifacts')

    dot.node('JsonFiles', 'JSON Output Files',
             fillcolor='#fff3e0', fontsize='10')

    dot.edge('OutputArtifacts', 'JsonFiles')

    # Dashboard
    dot.node('Dashboard', 'Dashboard UI',
             fillcolor='#e3f2fd', fontname='Helvetica Bold', fontsize='10')

    dot.edge('JsonFiles', 'Dashboard')

    with dot.subgraph() as s:
        s.attr(rank='same')
        s.node('Page1', 'Page 1:\nTemporal Evidence View', fontsize='8')
        s.node('Page2', 'Page 2:\nAnalytics View', fontsize='8')
        s.node('Page3', 'Page 3:\nPipeline Execution View', fontsize='8')

    dot.edge('Dashboard', 'Page1')
    dot.edge('Dashboard', 'Page2')
    dot.edge('Dashboard', 'Page3')

    # Render
    dot.render('tips_dfd', format='png', cleanup=True)
    dot.render('tips_dfd', format='pdf', cleanup=True)
    dot.render('tips_dfd', format='svg', cleanup=True)

    print("DFD saved to tips_dfd.png, tips_dfd.pdf, and tips_dfd.svg")


if __name__ == '__main__':
    draw_dfd()

